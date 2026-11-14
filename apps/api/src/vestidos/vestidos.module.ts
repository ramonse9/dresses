import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Vestido } from './entities/vestido.tenant-entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Vestido])],
})
export class VestidosModule {}
