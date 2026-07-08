import { IsInt, Min } from 'class-validator';

export class TravelBodyDto {
  @IsInt()
  @Min(1)
  zoneId!: number;
}
