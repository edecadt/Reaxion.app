import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class OAuthRedirectMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const redirectUri = req.query.redirect_uri as string;

    if (redirectUri) {
      (req as any).session.oauth_redirect_uri = redirectUri;
    }

    next();
  }
}
