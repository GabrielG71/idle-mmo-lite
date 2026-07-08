import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CharactersModule } from '../characters/characters.module';
import { CharacterTickerGateway } from './character-ticker.gateway';

@Module({
  imports: [AuthModule, CharactersModule],
  providers: [CharacterTickerGateway],
})
export class RealtimeModule {}
