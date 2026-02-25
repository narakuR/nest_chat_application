import { TypeOrmModule } from '@nestjs/typeorm';

export const typeOrmConfig = TypeOrmModule.forRoot({
  type: 'mysql',
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  username: process.env.DB_USERNAME,
  // password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // entities: [],
  autoLoadEntities: true, // 关键
  synchronize: true,
});
