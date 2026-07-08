import { IsInt, Min } from 'class-validator';

export class CreateCharacterBodyDto {
  @IsInt()
  @Min(1)
  classId!: number;
}
