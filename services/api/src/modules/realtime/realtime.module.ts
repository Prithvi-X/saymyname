import { Global, Module } from '@nestjs/common';
import { MatchAccessModule } from '../safety/match-access.module';
import { RealtimeTicketService } from './realtime-ticket.service';
import { RealtimeEventBusService } from './realtime-event-bus.service';
import { MessagingGateway } from './messaging.gateway';
import { MessagingOutboxRelayService } from './messaging-outbox-relay.service';

@Global()
@Module({
  imports: [MatchAccessModule],
  providers: [
    RealtimeTicketService,
    RealtimeEventBusService,
    MessagingGateway,
    MessagingOutboxRelayService,
  ],
  exports: [
    RealtimeTicketService,
    RealtimeEventBusService,
    MessagingGateway,
    MessagingOutboxRelayService,
  ],
})
export class RealtimeModule {}
