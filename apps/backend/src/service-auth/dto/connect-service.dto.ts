import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class ConnectServiceDto {
  @IsNotEmpty()
  @IsString()
  serviceId!: string;

  @IsOptional()
  @IsString()
  redirectUrl?: string;
}

export class ApiKeyConnectDto {
  @IsNotEmpty()
  @IsString()
  serviceId!: string;

  @IsNotEmpty()
  @IsString()
  apiKey!: string;
}
