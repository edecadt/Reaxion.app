import { Module } from '@nestjs/common';
import { ServiceLoader } from './service-loader.service';
import { ServiceRegistry } from './service-registry.service';

@Module({
  providers: [ServiceLoader, ServiceRegistry],
  exports: [ServiceLoader, ServiceRegistry],
})
export class ServicesModule {}
