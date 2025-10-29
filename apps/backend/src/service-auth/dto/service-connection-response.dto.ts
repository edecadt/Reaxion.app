export class ServiceConnectionResponseDto {
  id!: string;
  serviceId!: string;
  authType!: string;
  scopes!: string[];
  isExpired!: boolean;
  createdAt!: Date;
  updatedAt!: Date;
  metadata?: Record<string, unknown>;
}
