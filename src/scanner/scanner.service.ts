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
      //   const metadataUrl = `https://solana-gateway.moralis.io/token/mainnet/${contract}/metadata`;
      //   const priceUrl = `https://solana-gateway.moralis.io/token/mainnet/${contract}/pairs`;

      const tokenMetaUrl = `https://pro-api.solscan.io/v2.0/token/meta?address=${contract}`;
      const holdersUrl = `https://pro-api.solscan.io/v2.0/token/holders?address=${contract}&page=1&page_size=20`;

      // Fetch metadata to validate the contract
      const respMetadata = await fetch(tokenMetaUrl, {
        method: 'GET',
        headers: { token: process.env.SOLSCAN_TOKEN },
      });

      // Check if metadata request was successful
      if (!respMetadata.ok) {
        return { error: 'Invalid contract format or metadata not found' };
      }

      const metadata = await respMetadata.json();

      // Validate the metadata to ensure it's an SPL token
      if (
        !metadata.data.name ||
        !metadata.data.symbol ||
        !metadata.data.supply ||
        !metadata.data.decimals
      ) {
        return { error: 'Invalid contract: Not a valid Solana SPL token' };
      }

      // Fetch holders data concurrently after validation
      const respHolders = await fetch(holdersUrl, {
        method: 'GET',
        headers: { token: process.env.SOLSCAN_TOKEN },
      });

      if (!respHolders.ok) {
        throw new Error('Failed to fetch price data');
      }

      const Holders = await respHolders.json();

      const calculateOwnership = (holders, totalSupply) => {
        return holders.map((holder) => {
          const percentage = (holder.amount / totalSupply) * 100;
          return {
            ...holder,
            percentage: percentage.toFixed(2), // Round to 2 decimal places for readability
          };
        });
      };

      // Respond with the collected data
      const tokenAnalyticData = {
        tokenName: metadata.data.name,
        tokenSymbol: metadata.data.symbol,
        totalSupply: metadata.data.supply,
        decimals: metadata.data.decimals,
        tokenHoldersCount: metadata.data.holder,
        creatorAddress: metadata.data.creator,
        mintSignature: metadata.data.create_tx,
        createdTime: metadata.data.created_time,
        price: metadata.data.price,
        marketCap: metadata.data.market_cap,
        marketCapRank: metadata.data.market_cap_rank,
      };

      const AgentRole = `You are an AI agent specializing in Solana blockchain analysis. Your task is to analyze an SPL token based on the provided on-chain data and generate detailed insights, key findings, and future projections. Please present the response in a structured format.

Here is the SPL token data:
- Token Name: ${tokenAnalyticData.tokenName}
- Symbol: ${tokenAnalyticData.tokenSymbol}
- Total Supply: ${tokenAnalyticData.totalSupply}
- Decimal: ${tokenAnalyticData.decimals}
- price : $${tokenAnalyticData.price}
- marketCap : ${tokenAnalyticData.marketCap}
- numbers of holders : ${tokenAnalyticData.tokenHoldersCount}

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
        tokenDestribution: calculateOwnership(
          Holders.data.items,
          +tokenAnalyticData.totalSupply,
        ),
      };
    } catch (error) {
      console.error('Error generating reply:', error);
      return { error: 'There was an error processing the request...' };
    }
  }
}
