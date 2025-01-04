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
      const baseUrl = `https://solana-gateway.moralis.io/token/mainnet/${contract}/metadata`;

      const resp = await fetch(baseUrl, {
        method: 'GET',
        headers: { 'X-API-Key': process.env.MORALIS_KEY },
      });

      if (!resp) {
        throw new Error(`Failed to fetch data`);
      }

      const data = await resp.json();
      console.log(data); // Adjust based on how you plan to use the data

      // Respond with the collected data
      const tokenAnalyticData = {
        tokenName: data.name,
        tokenSymbol: data.symbol,
        tokenStandard: data.standard,
        totalSupply: data.totalSupplyFormatted,
        decimals: data.decimals,
        isMutable: data.metaplex.isMutable,
      };

      const AgentRole = `You are an AI agent specializing in Solana blockchain analysis. Your task is to analyze an SPL token based on the provided on-chain data and generate detailed insights, key findings, and future projections. Please present the response in a structured format.

Here is the SPL token data:
- Token Name: ${tokenAnalyticData.tokenName}
- Symbol: ${tokenAnalyticData.tokenSymbol}
- Total Supply: ${tokenAnalyticData.totalSupply}
- isMutabel: ${tokenAnalyticData.isMutable}
- Token standard: ${tokenAnalyticData.tokenStandard}
- Decimal" ${tokenAnalyticData.decimals}

Please provide the following:
1. **Token Insights**: Key observations about the token.
2. **Projections**: Predict future trends in growth, market interest, and volatility.
3. **Actionable Advice**: Recommendations for token holders or potential investors.

Use a concise, professional tone and present your findings in an organized manner.`;

      const response = await this.openai.chat.completions.create({
        messages: [
          { role: 'assistant', content: AgentRole },
          { role: 'user', content: 'Analyze this token' },
        ],
        model: 'gpt-4o-mini',
      });

      const reply = response.choices[0].message?.content.trim();
      //   console.log(reply);
      return { reply };
    } catch (error) {
      console.error('Error generating reply:', error);
      return 'There was an error processing request...';
    }
  }
}
