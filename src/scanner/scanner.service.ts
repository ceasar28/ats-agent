import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import * as dotenv from 'dotenv';

dotenv.config();

@Injectable()
export class ScannerService {
  private readonly openai: OpenAI;
  constructor() {
    // Initialize OpenAI API client
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY, // This is the default and can be omitted
    });
  }

  async tokenAnalyzer(contract: string): Promise<any> {
    try {
      const metadataUrl = `https://solana-gateway.moralis.io/token/mainnet/${contract}/metadata`;
      const priceUrl = `https://solana-gateway.moralis.io/token/mainnet/${contract}/pairs`;

      // Fetch metadata to validate the contract
      const respMetadata = await fetch(metadataUrl, {
        method: 'GET',
        headers: { 'X-API-Key': process.env.MORALIS_KEY },
      });

      // Check if metadata request was successful
      if (!respMetadata.ok) {
        return { error: 'Invalid contract format or metadata not found' };
      }

      const metadata = await respMetadata.json();

      // Validate the metadata to ensure it's an SPL token
      if (
        !metadata.name ||
        !metadata.symbol ||
        !metadata.totalSupplyFormatted ||
        !metadata.decimals
      ) {
        return { error: 'Invalid contract: Not a valid Solana SPL token' };
      }

      // Fetch price data concurrently after validation
      const respPrice = await fetch(priceUrl, {
        method: 'GET',
        headers: { 'X-API-Key': process.env.MORALIS_KEY },
      });

      if (!respPrice.ok) {
        throw new Error('Failed to fetch price data');
      }

      const tokenPrice = await respPrice.json();

      // Respond with the collected data
      const tokenAnalyticData = {
        tokenName: metadata.name,
        tokenSymbol: metadata.symbol,
        totalSupply: metadata.totalSupplyFormatted,
        decimals: metadata.decimals,
        exchangeName: tokenPrice.pairs?.[0]?.exchangeName || 'N/A',
        pairLabel: tokenPrice.pairs?.[0]?.pairLabel || 'N/A',
        usdPrice: tokenPrice.pairs?.[0]?.usdPrice || 0,
        marketCap:
          (tokenPrice.pairs?.[0]?.usdPrice || 0) *
          parseFloat(metadata.totalSupplyFormatted),
      };

      const AgentRole = `You are an AI agent specializing in Solana blockchain analysis. Your task is to analyze an SPL token based on the provided on-chain data and generate detailed insights, key findings, and future projections. Please present the response in a structured format.

Here is the SPL token data:
- Token Name: ${tokenAnalyticData.tokenName}
- Symbol: ${tokenAnalyticData.tokenSymbol}
- Total Supply: ${tokenAnalyticData.totalSupply}
- Decimal: ${tokenAnalyticData.decimals}
- price : $${tokenAnalyticData.usdPrice}
- marketCap by exchange (${tokenAnalyticData.exchangeName}): ${tokenAnalyticData.marketCap}

Please provide the following:
{
- summary:Key observations about the token and summary,
- tokenInfo:info about the token, like name, symbol, decimal, total supply, ismutable,
- Warnings: Predict future trends in growth, market interest, and volatility. Provide warnings if necessary or indicate no warnings,
- actionableAdvice: Recommendations for token holders or potential investors,
- ValueAndMarketCapitalization:Provide the price of the token in dollars and the Market capitalization.
}

Use a concise, professional tone and present your findings in an organized manner. and always let it be a stringified object is the format {...} and never json{...}`;

      const response = await this.openai.chat.completions.create({
        messages: [
          { role: 'assistant', content: AgentRole },
          { role: 'user', content: 'Analyze this token' },
        ],
        model: 'gpt-4o-mini',
      });

      const response2 = await this.openai.chat.completions.create({
        messages: [
          { role: 'assistant', content: AgentRole },
          {
            role: 'user',
            content:
              'just answer true or false, is this token a honeypot token based on your analysis of the giving data, you answer must be true or false nothing else',
          },
        ],
        model: 'gpt-4o-mini',
      });

      const AIresponse = response.choices[0].message?.content.trim();
      const AIresponse2 = response2.choices[0].message?.content.trim();
      return {
        AIresponse: JSON.parse(AIresponse),
        tokenDetails: { ...tokenAnalyticData, isHoneyPot: AIresponse2 },
      };
    } catch (error) {
      console.error('Error generating reply:', error);
      return { error: 'There was an error processing the request...' };
    }
  }
}
