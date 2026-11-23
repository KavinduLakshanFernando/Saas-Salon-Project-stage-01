import { Controller, Get, Param, Query } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { WebsitesService } from './websites.service';
import { ResolveWebsiteQueryDto } from './dto/website.dto';

@Controller('public/websites')
export class PublicWebsitesController {
  constructor(private readonly websitesService: WebsitesService) {}

  /**
   * Fast hostname / subdomain resolver for Next.js proxy and SSR
   */
  @Get('resolve')
  @Throttle({ default: { limit: 120, ttl: 60000 } })
  resolve(@Query() query: ResolveWebsiteQueryDto) {
    return this.websitesService.resolveWebsite(query);
  }

  /**
   * Available website templates catalog
   */
  @Get('templates')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  getTemplates() {
    return this.websitesService.getAvailableTemplates();
  }

  /**
   * Full website data payload by hostname or subdomain query
   */
  @Get('data')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  getPublicData(@Query() query: ResolveWebsiteQueryDto) {
    return this.websitesService.getPublicWebsiteData(query);
  }

  /**
   * Full website data payload by explicit subdomain param
   */
  @Get('by-subdomain/:subdomain')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  getBySubdomain(@Param('subdomain') subdomain: string) {
    return this.websitesService.getPublicWebsiteData({ subdomain });
  }
}
