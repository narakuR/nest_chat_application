import { Controller, Get, HttpCode } from '@nestjs/common';

@Controller()
export class RootController {
  constructor() {}

  @Get()
  getHello(): string {
    throw new Error('test');
    // return "ok";
  }

  @Get('.well-known/appspecific/com.chrome.devtools.json')
  @HttpCode(200)
  getChromeDevTools(): string {
    return 'no provided';
  }
}
