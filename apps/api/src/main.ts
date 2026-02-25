import { NestFactory } from '@nestjs/core';
import { RootModule } from './modules/root/root.module';
import { join } from 'path';
import { NestApplication } from '@nestjs/core';

async function bootstrap() {
  const app = await NestFactory.create<NestApplication>(RootModule);
  app.useStaticAssets(join(__dirname, '..', 'static'), {
    prefix: '/static/',
  });
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
