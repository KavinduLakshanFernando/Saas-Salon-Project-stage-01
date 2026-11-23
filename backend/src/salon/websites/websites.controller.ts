import {
  Body,
  Controller,
  Get,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { CurrentTenant } from '../../tenant/decorators/current-tenant.decorator';
import { RequirePermission } from '../../tenant/decorators/require-permission.decorator';
import { PermissionGuard } from '../../tenant/guards/permission.guard';
import { TenantContextGuard } from '../../tenant/guards/tenant-context.guard';
import { TenantContext } from '../../tenant/interfaces/tenant-context.interface';
import { WebsitesService } from './websites.service';
import {
  PublishSalonWebsiteDto,
  UpdateSalonWebsiteDto,
  SaveDraftWebsiteDto,
} from './dto/website.dto';

@Controller('tenant/website')
@UseGuards(JwtAuthGuard, TenantContextGuard, PermissionGuard)
export class WebsitesController {
  constructor(private readonly websitesService: WebsitesService) {}

  /**
   * Get salon website record for tenant admin (includes draft, published, urls, and diff state)
   */
  @Get()
  @RequirePermission('WEBSITE_VIEW')
  getWebsite(@CurrentTenant() tenant: TenantContext) {
    return this.websitesService.getWebsite(tenant.tenantId);
  }

  /**
   * Get available website templates metadata
   */
  @Get('templates')
  @RequirePermission('WEBSITE_VIEW')
  getTemplates() {
    return this.websitesService.getAvailableTemplates();
  }

  /**
   * Save website draft (does NOT modify live published site)
   */
  @Put('draft')
  @RequirePermission('WEBSITE_UPDATE')
  saveDraft(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: SaveDraftWebsiteDto,
  ) {
    return this.websitesService.saveDraft(tenant.tenantId, dto);
  }

  /**
   * Publish website (copies draft to published and activates live site)
   */
  @Post('publish')
  @RequirePermission('WEBSITE_PUBLISH')
  publish(@CurrentTenant() tenant: TenantContext) {
    return this.websitesService.publishWebsite(tenant.tenantId);
  }

  /**
   * Unpublish website (sets to draft mode)
   */
  @Post('unpublish')
  @RequirePermission('WEBSITE_PUBLISH')
  unpublish(@CurrentTenant() tenant: TenantContext) {
    return this.websitesService.unpublishWebsite(tenant.tenantId);
  }

  /**
   * Reset draft content back to currently published content
   */
  @Post('reset-draft')
  @RequirePermission('WEBSITE_UPDATE')
  resetDraft(@CurrentTenant() tenant: TenantContext) {
    return this.websitesService.resetDraft(tenant.tenantId);
  }

  /**
   * Secure image upload for website (logos, hero banners, gallery photos)
   */
  @Post('upload')
  @RequirePermission('WEBSITE_UPDATE')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB max
    }),
  )
  uploadImage(
    @CurrentTenant() tenant: TenantContext,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Query('category') category: 'logo' | 'hero' | 'gallery' = 'gallery',
  ) {
    return this.websitesService.uploadWebsiteImage(tenant.tenantId, file, category);
  }

  /**
   * Update top-level website configuration / legacy endpoint
   */
  @Patch()
  @RequirePermission('WEBSITE_UPDATE')
  updateWebsite(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: UpdateSalonWebsiteDto,
  ) {
    return this.websitesService.updateWebsite(tenant.tenantId, dto);
  }

  /**
   * Toggle publish / draft status via flag
   */
  @Post('set-publish')
  @RequirePermission('WEBSITE_PUBLISH')
  setPublishStatus(
    @CurrentTenant() tenant: TenantContext,
    @Body() dto: PublishSalonWebsiteDto,
  ) {
    return this.websitesService.setPublishStatus(tenant.tenantId, dto.isPublished);
  }

  /**
   * Explicitly provision draft website
   */
  @Post('provision')
  @RequirePermission('WEBSITE_UPDATE')
  provisionDraftWebsite(@CurrentTenant() tenant: TenantContext) {
    return this.websitesService.provisionDraftWebsite(tenant.tenantId);
  }
}
