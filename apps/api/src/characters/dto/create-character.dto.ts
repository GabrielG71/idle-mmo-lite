import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class CreateCharacterBodyDto {
  @IsInt()
  @Min(1)
  classId!: number;

  @IsOptional()
  @IsString()
  @MaxLength(24)
  nickname?: string;
}
