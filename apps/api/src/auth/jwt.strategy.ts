import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { JwtPayload } from './decorators';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
    constructor() {
        super({
            jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
            ignoreExpiration: false,
            secretOrKey: process.env.JWT_SECRET || 'fallback-dev-secret',
        });
    }

    validate(payload: JwtPayload): JwtPayload {
        return {
            sub: payload.sub,
            email: payload.email,
            role: payload.role,
            brandId: payload.brandId,
        };
    }
}
