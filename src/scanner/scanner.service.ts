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

      // Fetch both metadata and price data concurrently
      const [respMetadata, respPrice] = await Promise.all([
        fetch(metadataUrl, {
          method: 'GET',
          headers: { 'X-API-Key': process.env.MORALIS_KEY },
        }),
        fetch(priceUrl, {
          method: 'GET',
          headers: { 'X-API-Key': process.env.MORALIS_KEY },
        }),
      ]);

      // Check if any response failed
      if (!respMetadata.ok || !respPrice.ok) {
        throw new Error('Failed to fetch data from one or both endpoints');
      }

      const metadata = await respMetadata.json();
      const tokenPrice = await respPrice.json();

      // Respond with the collected data
      const tokenAnalyticData = {
        tokenName: metadata.name,
        tokenSymbol: metadata.symbol,
        totalSupply: metadata.totalSupplyFormatted,
        decimals: metadata.decimals,
        exchangeName: tokenPrice.pairs[0].exchangeName,
        pairLabel: tokenPrice.pairs[0].pairLabel,
        usdPrice: tokenPrice.pairs[0].usdPrice,
        marketCap:
          tokenPrice.pairs[0].usdPrice *
          parseFloat(metadata.totalSupplyFormatted),
      };
      console.log(tokenAnalyticData);
      const AgentRole = `You are an AI agent specializing in Solana blockchain analysis. Your task is to analyze an SPL token based on the provided on-chain data and generate detailed insights, key findings, and future projections. Please present the response in a structured format.

Here is the SPL token data:
- Token Name: ${tokenAnalyticData.tokenName}
- Symbol: ${tokenAnalyticData.tokenSymbol}
- Total Supply: ${tokenAnalyticData.totalSupply}
- Decimal: ${tokenAnalyticData.decimals}
- price : $${tokenAnalyticData.usdPrice}
- marketCap by exchange (${tokenAnalyticData.exchangeName}): ${tokenAnalyticData.marketCap}


Please provide the following:
1. **Summary**: Key observations about the token and summary.
2. ** Token info: info about the token, like name, symbor, decimal, total supply, ismutable
3. **Warnings**: Predict future trends in growth, market interest, and volatility. provide warning if need by or no warning.
4. **Actionable Advice**: Recommendations for token holders or potential investors.
5. **Value and Market Capitalization**:  give the price of the token in dollars and the Market captilization


Use a concise, professional tone and present your findings in an organized manner.`;

      const response = await this.openai.chat.completions.create({
        messages: [
          { role: 'assistant', content: AgentRole },
          { role: 'user', content: 'Analyze this token' },
        ],
        model: 'gpt-4o-mini',
      });

      const AIresponse = response.choices[0].message?.content.trim();
      //   console.log(reply);
      return { AIresponse, tokenDetails: tokenAnalyticData };
    } catch (error) {
      console.error('Error generating reply:', error);
      return 'There was an error processing request...';
    }
  }
}
