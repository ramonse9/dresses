import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReservacionVestido } from './entities/reservacion-vestido.tenant-entity.js';
import { Reservacion } from './entities/reservacion.tenant-entity.js';

@Module({
  imports: [TypeOrmModule.forFeature([Reservacion, ReservacionVestido])],
})
export class ReservacionesModule {}
