import { Module } from '@nestjs/common';
import { NfceModule } from '../nfce/nfce.module';
import { UserController } from './user.controller';
import { UserService } from './user.service';

@Module({
  imports: [NfceModule],
  controllers: [UserController],
  providers: [UserService],
})
export class UserModule {}
