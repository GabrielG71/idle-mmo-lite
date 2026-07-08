import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import { IncomingMessage } from 'http';
import { WebSocket } from 'ws';
import { JwtPayload } from '../auth/jwt.strategy';
import { CharactersService } from '../characters/characters.service';

interface ClientState {
  interval: ReturnType<typeof setInterval>;
}

/**
 * Ticker do PiP (Fase 4, §5/§6.1): puramente transporte — nenhuma lógica de
 * jogo nova aqui, só reenvia `CharactersService.getState` (o mesmo payload
 * de `GET /characters/:id`) em loop pro widget renderizar ao vivo.
 *
 * Auth via query string (`?token=...&characterId=...`): é a única forma de
 * autenticar um WebSocket nativo do browser sem header custom. Trade-off
 * conhecido de v0 — revisar se virar problema real (token pode ficar em
 * logs de acesso).
 */
@WebSocketGateway({ path: '/ws/characters', cors: { origin: '*' } })
export class CharacterTickerGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(CharacterTickerGateway.name);
  private readonly clients = new Map<WebSocket, ClientState>();

  constructor(
    private readonly jwt: JwtService,
    private readonly characters: CharactersService,
  ) {}

  async handleConnection(client: WebSocket, request: IncomingMessage): Promise<void> {
    try {
      const url = new URL(request.url ?? '', 'http://localhost');
      const token = url.searchParams.get('token');
      const characterId = url.searchParams.get('characterId');
      if (!token || !characterId) throw new Error('missing token or characterId');

      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      // Reaproveita a mesma checagem de posse usada em toda a REST.
      await this.characters.getState(characterId, payload.sub);

      const interval = setInterval(() => {
        void this.tick(client, characterId, payload.sub);
      }, 1000);
      this.clients.set(client, { interval });
    } catch (err) {
      this.logger.debug(`Rejecting ws connection: ${(err as Error).message}`);
      client.close();
    }
  }

  handleDisconnect(client: WebSocket): void {
    const state = this.clients.get(client);
    if (state) {
      clearInterval(state.interval);
      this.clients.delete(client);
    }
  }

  private async tick(client: WebSocket, characterId: string, userId: string): Promise<void> {
    try {
      const state = await this.characters.getState(characterId, userId);
      if (client.readyState === client.OPEN) {
        client.send(JSON.stringify(state));
      }
    } catch {
      client.close();
    }
  }
}
