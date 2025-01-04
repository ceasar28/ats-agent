import { Body, Controller, Post } from '@nestjs/common';
import { ScannerService } from './scanner.service';

@Controller('scanner')
export class ScannerController {
  constructor(private readonly scannerService: ScannerService) {}

  @Post()
  async scanToken(@Body() body: any): Promise<any> {
    return this.scannerService.tokenAnalyzer(body.contract);
  }
}
