import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import {
  Globe,
  Sparkles,
  Eye,
  Check,
  Copy,
  ExternalLink,
  CheckCircle2,
  Clock,
  Layers,
  Crown,
  Leaf,
  Scissors,
  AlertCircle,
  ShieldCheck,
  Palette,
  BookOpen,
  Image as ImageIcon,
  Phone,
  Search,
  Upload,
  Trash2,
  Plus,
  Save,
  RotateCcw,
} from 'lucide-react';
import { websiteApi } from '@/features/website/api/website.api';
import type {
  SalonWebsiteEntity,
  WebsiteTemplateInfo,
  SupportedTemplateId,
  WebsiteStructuredContent,
  GalleryPhoto,
} from '@/features/website/types/website.types';
import { WebsitePreviewModal } from '@/features/website/components/WebsitePreviewModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/contexts/AuthContext';

const COLOR_PRESETS = [
  { name: 'Royal Purple', primary: '#7C3AED', secondary: '#EC4899' },
  { name: 'Bridal Gold', primary: '#D97706', secondary: '#BE185D' },
  { name: 'Emerald Spa', primary: '#059669', secondary: '#0284C7' },
  { name: 'Rose Petal', primary: '#E11D48', secondary: '#F43F5E' },
  { name: 'Ocean Cyan', primary: '#0284C7', secondary: '#38BDF8' },
  { name: 'Midnight Onyx', primary: '#0F172A', secondary: '#475569' },
];

type EditorTab = 'templates' | 'branding' | 'about' | 'gallery' | 'contact' | 'seo';

export default function WebsiteBuilderPage() {
  const { user } = useAuth();
  const [website, setWebsite] = useState<SalonWebsiteEntity | null>(null);
  const [templates, setTemplates] = useState<WebsiteTemplateInfo[]>([]);
  const [draft, setDraft] = useState<WebsiteStructuredContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<EditorTab>('templates');
  const [hasChanges, setHasChanges] = useState(false);

  // File input refs
  const logoInputRef = useRef<HTMLInputElement>(null);
  const heroInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // New gallery photo inputs
  const [newPhotoCaption, setNewPhotoCaption] = useState('');

  // Check if Advanced Booking feature is active
  const hasAdvancedBooking = Boolean(user?.features?.includes('ADVANCED_BOOKING'));

  // Initial load
  const loadData = async () => {
    try {
      setLoading(true);
      const [webData, tmplData] = await Promise.all([
        websiteApi.getWebsite(),
        websiteApi.getTemplates(),
      ]);
      setWebsite(webData);
      setTemplates(tmplData);
      setDraft(webData.draftContent);
      setHasChanges(false);
    } catch (error: any) {
      console.error('Failed to load website settings:', error);
      toast.error(error?.response?.data?.message || 'Failed to load salon website data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Update draft helper
  const updateDraft = (updater: (prev: WebsiteStructuredContent) => WebsiteStructuredContent) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = updater(prev);
      setHasChanges(true);
      return next;
    });
  };

  // Save draft content
  const handleSaveDraft = async (silent = false) => {
    if (!draft) return;
    try {
      setSaving(true);
      const updated = await websiteApi.saveDraft(draft);
      setWebsite(updated);
      setDraft(updated.draftContent);
      setHasChanges(false);
      if (!silent) {
        toast.success('Draft saved successfully! Click "Publish Website" when ready to make it live.');
      }
    } catch (error: any) {
      console.error('Error saving draft:', error);
      toast.error(error?.response?.data?.message || 'Failed to save draft content');
    } finally {
      setSaving(false);
    }
  };

  // Handle template selection
  const handleSelectTemplate = async (templateId: SupportedTemplateId) => {
    if (!draft) return;
    updateDraft((prev) => ({
      ...prev,
      templateId,
    }));

    try {
      setSaving(true);
      const updated = await websiteApi.saveDraft({
        ...draft,
        templateId,
      });
      setWebsite(updated);
      setDraft(updated.draftContent);
      setHasChanges(false);
      toast.success(
        `Selected "${templates.find((t) => t.id === templateId)?.name || templateId}". Draft updated!`,
      );
    } catch (error: any) {
      console.error('Error selecting template:', error);
      toast.error('Failed to update template');
    } finally {
      setSaving(false);
    }
  };

  // Publish website live
  const handlePublish = async () => {
    try {
      setPublishing(true);
      if (hasChanges && draft) {
        await websiteApi.saveDraft(draft);
      }
      const updated = await websiteApi.publish();
      setWebsite(updated);
      setDraft(updated.draftContent);
      setHasChanges(false);
      toast.success('Website published live successfully!');
    } catch (error: any) {
      console.error('Error publishing website:', error);
      toast.error(error?.response?.data?.message || 'Failed to publish website');
    } finally {
      setPublishing(false);
    }
  };

  // Unpublish website (set to draft)
  const handleUnpublish = async () => {
    try {
      setPublishing(true);
      const updated = await websiteApi.unpublish();
      setWebsite(updated);
      toast.info('Website set to draft mode.');
    } catch (error: any) {
      console.error('Error unpublishing website:', error);
      toast.error(error?.response?.data?.message || 'Failed to unpublish website');
    } finally {
      setPublishing(false);
    }
  };

  // Revert draft back to current published state
  const handleResetDraft = async () => {
    try {
      setSaving(true);
      const updated = await websiteApi.resetDraft();
      setWebsite(updated);
      setDraft(updated.draftContent);
      setHasChanges(false);
      toast.info('Draft changes discarded. Reverted to live published content.');
    } catch (error: any) {
      console.error('Error resetting draft:', error);
      toast.error(error?.response?.data?.message || 'Failed to discard draft changes');
    } finally {
      setSaving(false);
    }
  };

  // Image Upload handler
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    category: 'logo' | 'hero' | 'gallery',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must not exceed 5MB');
      return;
    }

    try {
      setUploadingCategory(category);
      const res = await websiteApi.uploadImage(file, category);

      if (category === 'logo') {
        updateDraft((prev) => ({
          ...prev,
          branding: { ...prev.branding, logoUrl: res.url },
        }));
        toast.success('Logo uploaded! Click "Save Draft" to persist.');
      } else if (category === 'hero') {
        updateDraft((prev) => ({
          ...prev,
          branding: { ...prev.branding, bannerUrl: res.url },
          hero: { ...prev.hero, heroImageUrl: res.url },
        }));
        toast.success('Hero image uploaded! Click "Save Draft" to persist.');
      } else if (category === 'gallery') {
        const newPhoto: GalleryPhoto = {
          url: res.url,
          caption: newPhotoCaption.trim() || undefined,
          category: 'Salon',
        };
        updateDraft((prev) => ({
          ...prev,
          gallery: [...(prev.gallery || []), newPhoto],
        }));
        setNewPhotoCaption('');
        toast.success('Gallery photo added! Click "Save Draft" to persist.');
      }
    } catch (error: any) {
      console.error('Upload failed:', error);
      toast.error(error?.response?.data?.message || 'Failed to upload image');
    } finally {
      setUploadingCategory(null);
      e.target.value = '';
    }
  };

  // Remove gallery photo
  const handleRemovePhoto = (index: number) => {
    updateDraft((prev) => ({
      ...prev,
      gallery: (prev.gallery || []).filter((_, i) => i !== index),
    }));
  };

  // Copy website URL to clipboard
  const handleCopyUrl = async () => {
    if (!website) return;
    const url = website.publishedUrl || website.previewUrl;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success('Website URL copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error('Failed to copy URL');
    }
  };

  // Open Preview Modal (auto-saving draft if unsaved)
  const handleOpenPreview = async () => {
    if (hasChanges && draft) {
      await handleSaveDraft(true);
    }
    setPreviewOpen(true);
  };

  // Helper icon for template
  const getTemplateIcon = (id: string) => {
    switch (id) {
      case 'luxury-bridal':
        return <Crown className="w-5 h-5 text-amber-500" />;
      case 'spa-wellness':
        return <Leaf className="w-5 h-5 text-emerald-500" />;
      case 'modern-beauty':
      default:
        return <Scissors className="w-5 h-5 text-purple-500" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-6 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-purple-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-600">Loading website editor...</p>
      </div>
    );
  }

  if (!website || !draft) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 max-w-lg mx-auto my-12 space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
        <h3 className="text-lg font-bold text-slate-900">Website Not Found</h3>
        <p className="text-sm text-slate-500">
          We could not locate the website record for your salon. Please contact customer support.
        </p>
      </div>
    );
  }

  const activeDraftTemplateId = draft.templateId || website.templateId;
  const activePublishedTemplateId = website.publishedContent?.templateId || website.templateId;
  const currentTemplate = templates.find((t) => t.id === activeDraftTemplateId) || templates[0];
  const hasUnpublishedChanges = hasChanges || website.hasUnpublishedChanges || activeDraftTemplateId !== activePublishedTemplateId;

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
      {/* ========================================================================= */}
      {/* 1. TOP HEADER & STATUS BAR                                               */}
      {/* ========================================================================= */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200/80">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center font-bold shadow-xs">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
                  Website Management &amp; Builder
                </h1>
                {website.isPublished ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    Live
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                    Draft
                  </span>
                )}
                {hasUnpublishedChanges && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200 animate-pulse">
                    Unpublished Draft Edits
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Customize your salon branding, hero imagery, story, photos, and public website templates.
              </p>
            </div>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {hasChanges && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleSaveDraft(false)}
              disabled={saving}
              className="text-xs h-9 gap-1.5 font-bold border-purple-300 text-purple-700 hover:bg-purple-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Draft'}
            </Button>
          )}

          <Button
            variant="outline"
            size="sm"
            onClick={handleOpenPreview}
            className="text-xs h-9 gap-1.5 font-semibold text-slate-700 border-slate-300 hover:bg-slate-50"
          >
            <Eye className="w-3.5 h-3.5 text-purple-600" />
            Preview Draft
          </Button>

          {website.isPublished ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnpublish}
                disabled={publishing}
                className="text-xs h-9 text-rose-600 border-rose-200 hover:bg-rose-50 font-semibold"
              >
                Unpublish
              </Button>
              <Button
                size="sm"
                onClick={handlePublish}
                disabled={publishing || !hasUnpublishedChanges}
                className="text-xs h-9 gap-1.5 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {publishing ? 'Publishing...' : 'Update Live Website'}
              </Button>
            </>
          ) : (
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={publishing}
              className="text-xs h-9 gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {publishing ? 'Publishing...' : 'Publish Website Live'}
            </Button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ASSIGNED WEBSITE URL BANNER                                            */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-purple-900 to-indigo-900 rounded-3xl p-5 sm:p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <span className="text-[11px] font-bold uppercase tracking-wider text-purple-200">
              Assigned Public Website Address
            </span>
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="font-mono text-sm sm:text-base font-bold text-white bg-black/25 px-3 py-1 rounded-xl border border-white/10 break-all">
                {website.publishedUrl}
              </span>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={handleCopyUrl}
                className="h-8 px-2.5 text-xs font-semibold gap-1 bg-white text-slate-900 hover:bg-purple-50"
              >
                {copied ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy URL</span>
                  </>
                )}
              </Button>
            </div>
            <p className="text-[11px] text-purple-200/80">
              Template: <strong className="text-white">{currentTemplate?.name}</strong> • Subdomain: <strong className="text-white">{website.subdomain}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <a
              href={website.publishedUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all backdrop-blur-xs"
            >
              <span>Visit Live Website</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ADVANCED BOOKING NOTICE (Requirement 6/9)                              */}
      {/* ========================================================================= */}
      {hasAdvancedBooking ? (
        <div className="p-3.5 bg-emerald-50/80 border border-emerald-200 rounded-2xl flex items-center gap-3 text-xs text-emerald-900">
          <ShieldCheck className="w-4 h-4 text-emerald-700 shrink-0" />
          <span>
            <strong className="font-bold text-emerald-950">Advanced Booking Active: </strong>
            Your website displays real-time salon services, branch locations, and 24/7 online customer appointment scheduling.
          </span>
        </div>
      ) : (
        <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-2xl flex items-center gap-3 text-xs text-blue-900">
          <Layers className="w-4 h-4 text-blue-700 shrink-0" />
          <span>
            <strong className="font-bold text-blue-950">Website Plan: </strong>
            Your website showcases your salon brand, services, branches, and working hours. Customer booking actions direct visitors to your salon telephone numbers. (Online self-booking is enabled with the Advanced Booking plan).
          </span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. NAVIGATION TABS                                                        */}
      {/* ========================================================================= */}
      <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-2xl border border-slate-200/80 overflow-x-auto text-xs font-semibold text-slate-600">
        <button
          onClick={() => setActiveTab('templates')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'templates'
              ? 'bg-white text-purple-700 shadow-xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <Layers className="w-3.5 h-3.5" />
          <span>Templates</span>
        </button>

        <button
          onClick={() => setActiveTab('branding')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'branding'
              ? 'bg-white text-purple-700 shadow-xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <Palette className="w-3.5 h-3.5" />
          <span>Logo, Hero &amp; Colors</span>
        </button>

        <button
          onClick={() => setActiveTab('about')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'about'
              ? 'bg-white text-purple-700 shadow-xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <BookOpen className="w-3.5 h-3.5" />
          <span>About Story</span>
        </button>

        <button
          onClick={() => setActiveTab('gallery')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'gallery'
              ? 'bg-white text-purple-700 shadow-xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>Gallery ({draft.gallery?.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('contact')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'contact'
              ? 'bg-white text-purple-700 shadow-xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <Phone className="w-3.5 h-3.5" />
          <span>Contact &amp; Social</span>
        </button>

        <button
          onClick={() => setActiveTab('seo')}
          className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all whitespace-nowrap ${
            activeTab === 'seo'
              ? 'bg-white text-purple-700 shadow-xs font-bold'
              : 'hover:text-slate-900'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>SEO &amp; Meta</span>
        </button>
      </div>

      {/* Hidden File Inputs */}
      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'logo')}
      />
      <input
        ref={heroInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'hero')}
      />
      <input
        ref={galleryInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => handleFileUpload(e, 'gallery')}
      />

      {/* ========================================================================= */}
      {/* TAB 1: TEMPLATES                                                          */}
      {/* ========================================================================= */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-md border-2 border-white"
                style={{ backgroundColor: draft.branding.themeColor || currentTemplate?.defaultThemeColor || '#7C3AED' }}
              >
                {getTemplateIcon(activeDraftTemplateId)}
              </div>
              <div>
                <span className="text-[10px] font-bold text-purple-700 uppercase tracking-wider block">
                  Selected Template (Draft)
                </span>
                <h2 className="text-lg font-extrabold text-slate-900">
                  {currentTemplate?.name || 'Modern Beauty Salon'}
                </h2>
                <p className="text-xs text-slate-500">
                  {currentTemplate?.tagline} • Category: <strong className="text-slate-700">{currentTemplate?.category}</strong>
                </p>
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={handleOpenPreview}
              className="text-xs h-9 gap-1.5 border-slate-200 font-semibold"
            >
              <Eye className="w-3.5 h-3.5 text-purple-600" />
              Preview Template
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {templates.map((tmpl) => {
              const isSelectedDraft = tmpl.id === activeDraftTemplateId;
              const isSelectedLive = tmpl.id === activePublishedTemplateId;

              return (
                <div
                  key={tmpl.id}
                  className={`relative bg-white rounded-3xl border-2 transition-all flex flex-col justify-between overflow-hidden shadow-xs hover:shadow-md ${
                    isSelectedDraft
                      ? 'border-purple-600 ring-4 ring-purple-600/10'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
                    {isSelectedLive && website.isPublished && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-600 text-white shadow-xs">
                        Live
                      </span>
                    )}
                    {isSelectedDraft && (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-600 text-white shadow-xs">
                        <Check className="w-3 h-3 stroke-[3]" />
                        Selected
                      </span>
                    )}
                  </div>

                  <div>
                    <div
                      className="h-40 p-6 relative flex flex-col justify-between overflow-hidden"
                      style={{
                        background: `linear-gradient(135deg, ${tmpl.defaultThemeColor}18 0%, ${tmpl.defaultSecondaryColor}25 100%)`,
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-white/90 text-slate-800 shadow-xs backdrop-blur-xs">
                          {tmpl.category}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-4 h-4 rounded-full border border-white shadow-xs inline-block"
                            style={{ backgroundColor: tmpl.defaultThemeColor }}
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-white shadow-xs inline-block"
                            style={{ backgroundColor: tmpl.defaultSecondaryColor }}
                          />
                        </div>
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-xl flex items-center justify-center text-white shadow-xs"
                            style={{ backgroundColor: tmpl.defaultThemeColor }}
                          >
                            {getTemplateIcon(tmpl.id)}
                          </div>
                          <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                            {tmpl.name}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-600 line-clamp-1 font-medium">
                          {tmpl.tagline}
                        </p>
                      </div>
                    </div>

                    <div className="p-5 space-y-3">
                      <p className="text-xs text-slate-600 leading-relaxed min-h-[44px]">
                        {tmpl.description}
                      </p>

                      <div className="pt-2.5 border-t border-slate-100 space-y-1.5 text-xs">
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-0.5">
                            Ideal For
                          </span>
                          <p className="font-semibold text-slate-800 text-xs">
                            {tmpl.idealFor}
                          </p>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                            Highlights
                          </span>
                          <ul className="space-y-1">
                            {tmpl.features.map((feat, i) => (
                              <li key={i} className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                <span>{feat}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="p-5 pt-0 flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        if (!isSelectedDraft) {
                          handleSelectTemplate(tmpl.id);
                        }
                        handleOpenPreview();
                      }}
                      className="flex-1 text-xs h-9 border-slate-200 hover:bg-slate-50 font-semibold gap-1"
                    >
                      <Eye className="w-3.5 h-3.5 text-slate-500" />
                      Preview
                    </Button>

                    {isSelectedDraft ? (
                      <Button
                        size="sm"
                        disabled
                        className="flex-1 text-xs h-9 bg-purple-50 text-purple-700 border border-purple-200 font-bold gap-1 cursor-default opacity-100"
                      >
                        <Check className="w-3.5 h-3.5 text-purple-700" />
                        Selected
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => handleSelectTemplate(tmpl.id)}
                        disabled={saving}
                        className="flex-1 text-xs h-9 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs gap-1"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        Select
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: BRANDING & COLORS                                                  */}
      {/* ========================================================================= */}
      {activeTab === 'branding' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Logo & Hero Banner Uploads */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-purple-600" />
              <span>Salon Logo &amp; Hero Banner</span>
            </h3>

            {/* Logo Section */}
            <div className="space-y-2">
              <Label className="text-xs font-bold text-slate-700">Salon Brand Logo</Label>
              <div className="flex items-center gap-4">
                {draft.branding.logoUrl ? (
                  <img
                    src={draft.branding.logoUrl}
                    alt="Logo"
                    className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shadow-xs"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 border border-dashed border-slate-300 flex items-center justify-center text-slate-400 text-xs font-medium">
                    No Logo
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingCategory === 'logo'}
                    className="h-8 text-xs gap-1.5 border-slate-300"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    {uploadingCategory === 'logo' ? 'Uploading...' : 'Upload Logo'}
                  </Button>
                  {draft.branding.logoUrl && (
                    <button
                      type="button"
                      onClick={() => updateDraft((p) => ({ ...p, branding: { ...p.branding, logoUrl: null } }))}
                      className="text-[11px] text-rose-600 hover:underline text-left"
                    >
                      Remove logo
                    </button>
                  )}
                </div>
              </div>
              <p className="text-[11px] text-slate-400">Recommended: Square PNG/WEBP with transparent background (500x500px, max 5MB)</p>
            </div>

            {/* Hero Banner Section */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <Label className="text-xs font-bold text-slate-700">Hero Section Background Banner</Label>
              {draft.hero.heroImageUrl || draft.branding.bannerUrl ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200 h-36 bg-slate-100">
                  <img
                    src={draft.hero.heroImageUrl || draft.branding.bannerUrl || ''}
                    alt="Hero Banner"
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center gap-2 opacity-0 hover:opacity-100 transition-opacity">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => heroInputRef.current?.click()}
                      className="h-8 text-xs gap-1 bg-white text-slate-900"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      Replace
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() =>
                        updateDraft((p) => ({
                          ...p,
                          branding: { ...p.branding, bannerUrl: null },
                          hero: { ...p.hero, heroImageUrl: null },
                        }))
                      }
                      className="h-8 text-xs gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => heroInputRef.current?.click()}
                  className="h-32 rounded-2xl border-2 border-dashed border-slate-200 hover:border-purple-400 bg-slate-50 flex flex-col items-center justify-center cursor-pointer transition-colors p-4 text-center space-y-1"
                >
                  <Upload className="w-6 h-6 text-slate-400" />
                  <span className="text-xs font-semibold text-slate-700">
                    {uploadingCategory === 'hero' ? 'Uploading...' : 'Click to upload hero photo'}
                  </span>
                  <span className="text-[10px] text-slate-400">High-resolution landscape (1920x1080px recommended)</span>
                </div>
              )}
            </div>
          </div>

          {/* Title, Tagline & Theme Colors */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Palette className="w-4 h-4 text-purple-600" />
              <span>Branding Details &amp; Color Scheme</span>
            </h3>

            <div className="space-y-4">
              <div>
                <Label className="text-xs font-semibold text-slate-700">Website Title *</Label>
                <Input
                  value={draft.branding.title}
                  onChange={(e) => updateDraft((p) => ({ ...p, branding: { ...p.branding, title: e.target.value } }))}
                  placeholder="e.g. Salon Heart"
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Tagline / Subheading</Label>
                <Input
                  value={draft.branding.tagline || ''}
                  onChange={(e) => updateDraft((p) => ({ ...p, branding: { ...p.branding, tagline: e.target.value } }))}
                  placeholder="e.g. Colombo's Premier Hair & Bridal Lounge"
                  className="mt-1 text-xs"
                />
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700">Hero Headline (Large Greeting)</Label>
                <Input
                  value={draft.hero.headline || ''}
                  onChange={(e) => updateDraft((p) => ({ ...p, hero: { ...p.hero, headline: e.target.value } }))}
                  placeholder="e.g. Unleash Your Natural Radiance"
                  className="mt-1 text-xs"
                />
              </div>

              {/* Color Palette Picker */}
              <div className="pt-2 border-t border-slate-100 space-y-3">
                <Label className="text-xs font-bold text-slate-700">Brand Color Palettes</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {COLOR_PRESETS.map((preset) => (
                    <button
                      key={preset.name}
                      type="button"
                      onClick={() =>
                        updateDraft((p) => ({
                          ...p,
                          branding: {
                            ...p.branding,
                            themeColor: preset.primary,
                            secondaryColor: preset.secondary,
                          },
                        }))
                      }
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs font-medium transition-all ${
                        draft.branding.themeColor === preset.primary
                          ? 'border-purple-600 bg-purple-50/50 shadow-xs ring-2 ring-purple-600/10'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <span className="w-4 h-4 rounded-full shrink-0" style={{ backgroundColor: preset.primary }} />
                      <span className="w-4 h-4 rounded-full shrink-0 -ml-3 border border-white" style={{ backgroundColor: preset.secondary }} />
                      <span className="text-[11px] truncate">{preset.name}</span>
                    </button>
                  ))}
                </div>

                {/* Custom Color Inputs */}
                <div className="grid grid-cols-2 gap-3 pt-2">
                  <div>
                    <Label className="text-[11px] text-slate-500">Primary Theme Color</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={draft.branding.themeColor || '#7C3AED'}
                        onChange={(e) =>
                          updateDraft((p) => ({ ...p, branding: { ...p.branding, themeColor: e.target.value } }))
                        }
                        className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                      />
                      <Input
                        value={draft.branding.themeColor || '#7C3AED'}
                        onChange={(e) =>
                          updateDraft((p) => ({ ...p, branding: { ...p.branding, themeColor: e.target.value } }))
                        }
                        className="text-xs font-mono uppercase h-8"
                      />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[11px] text-slate-500">Secondary Accent Color</Label>
                    <div className="flex items-center gap-2 mt-1">
                      <input
                        type="color"
                        value={draft.branding.secondaryColor || '#EC4899'}
                        onChange={(e) =>
                          updateDraft((p) => ({ ...p, branding: { ...p.branding, secondaryColor: e.target.value } }))
                        }
                        className="w-8 h-8 rounded-lg cursor-pointer border border-slate-200 p-0.5"
                      />
                      <Input
                        value={draft.branding.secondaryColor || '#EC4899'}
                        onChange={(e) =>
                          updateDraft((p) => ({ ...p, branding: { ...p.branding, secondaryColor: e.target.value } }))
                        }
                        className="text-xs font-mono uppercase h-8"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: ABOUT STORY                                                        */}
      {/* ========================================================================= */}
      {activeTab === 'about' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 shadow-xs max-w-4xl mx-auto">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-purple-600" />
              <span>Salon Story &amp; About Section</span>
            </h3>
            <span className="text-xs text-slate-400">Featured across all 3 templates</span>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">About Section Heading</Label>
              <Input
                value={draft.about.heading || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, about: { ...p.about, heading: e.target.value } }))}
                placeholder="e.g. Crafting Timeless Beauty Since 2018"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Subheading / Philosophy Tagline</Label>
              <Input
                value={draft.about.subheading || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, about: { ...p.about, subheading: e.target.value } }))}
                placeholder="e.g. Dedicated to high-fashion styling, bespoke artistry, and organic wellness"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Our Story / Studio Bio</Label>
              <Textarea
                rows={5}
                value={draft.about.story || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  updateDraft((p) => ({ ...p, about: { ...p.about, story: e.target.value } }))
                }
                placeholder="Share your salon's founding journey, your passion for hairstyling/beauty, and what makes your treatments unique..."
                className="mt-1 text-xs leading-relaxed"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Founder's Quote / Signature Remark</Label>
              <Input
                value={draft.about.quote || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, about: { ...p.about, quote: e.target.value } }))}
                placeholder="e.g. 'True elegance begins when you step into confidence.' — Founder"
                className="mt-1 text-xs italic"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: GALLERY PHOTOS                                                     */}
      {/* ========================================================================= */}
      {activeTab === 'gallery' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-purple-600" />
                <span>Salon Work Gallery &amp; Mood Board</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Showcase hairstyles, bridal artistry, salon ambiance, and spa treatments.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Input
                placeholder="Photo caption (e.g. Bridal Updo)..."
                value={newPhotoCaption}
                onChange={(e) => setNewPhotoCaption(e.target.value)}
                className="text-xs h-9 w-56"
              />
              <Button
                size="sm"
                onClick={() => galleryInputRef.current?.click()}
                disabled={uploadingCategory === 'gallery'}
                className="h-9 text-xs gap-1.5 font-bold bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                {uploadingCategory === 'gallery' ? 'Uploading...' : 'Add Photo'}
              </Button>
            </div>
          </div>

          {/* Photos Grid */}
          {(draft.gallery || []).length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {draft.gallery.map((photo, index) => (
                <div
                  key={index}
                  className="group relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-50 aspect-square shadow-xs"
                >
                  <img src={photo.url} alt={photo.caption || 'Gallery photo'} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-3 text-white">
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(index)}
                      className="self-end p-1.5 rounded-lg bg-rose-600/80 hover:bg-rose-600 text-white transition-colors"
                      title="Delete photo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {photo.caption && <p className="text-[11px] font-medium line-clamp-2">{photo.caption}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              onClick={() => galleryInputRef.current?.click()}
              className="py-16 rounded-3xl border-2 border-dashed border-slate-200 hover:border-purple-300 flex flex-col items-center justify-center cursor-pointer transition-colors text-center space-y-2"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center">
                <Upload className="w-6 h-6" />
              </div>
              <h4 className="text-sm font-bold text-slate-800">No gallery photos added yet</h4>
              <p className="text-xs text-slate-400 max-w-sm">
                Click here or use the &quot;Add Photo&quot; button above to upload high-quality pictures of your salon work.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: CONTACT DETAILS & SOCIAL LINKS                                     */}
      {/* ========================================================================= */}
      {activeTab === 'contact' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Phone className="w-4 h-4 text-purple-600" />
              <span>Contact Information &amp; Hours</span>
            </h3>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Telephone / Mobile Phone</Label>
              <Input
                value={draft.contact.phone || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, contact: { ...p.contact, phone: e.target.value } }))}
                placeholder="e.g. +94 77 123 4567"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Public Email Address</Label>
              <Input
                type="email"
                value={draft.contact.email || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, contact: { ...p.contact, email: e.target.value } }))}
                placeholder="e.g. hello@salonheart.lk"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Physical Studio Address</Label>
              <Input
                value={draft.contact.address || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, contact: { ...p.contact, address: e.target.value } }))}
                placeholder="e.g. No. 45, Ward Place, Colombo 07"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Working Hours</Label>
              <Input
                value={draft.contact.workingHours || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, contact: { ...p.contact, workingHours: e.target.value } }))}
                placeholder="e.g. Tuesday - Sunday: 9:00 AM - 7:30 PM (Mondays Closed)"
                className="mt-1 text-xs"
              />
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-4 shadow-xs">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 pb-2 border-b border-slate-100">
              <Globe className="w-4 h-4 text-purple-600" />
              <span>Social Media Profiles</span>
            </h3>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Instagram Profile URL</Label>
              <Input
                value={draft.socialLinks.instagram || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, socialLinks: { ...p.socialLinks, instagram: e.target.value } }))}
                placeholder="https://instagram.com/salonheart"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Facebook Page URL</Label>
              <Input
                value={draft.socialLinks.facebook || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, socialLinks: { ...p.socialLinks, facebook: e.target.value } }))}
                placeholder="https://facebook.com/salonheart"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">WhatsApp Direct Chat Link or Number</Label>
              <Input
                value={draft.socialLinks.whatsapp || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, socialLinks: { ...p.socialLinks, whatsapp: e.target.value } }))}
                placeholder="https://wa.me/94771234567"
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">TikTok Profile URL</Label>
              <Input
                value={draft.socialLinks.tiktok || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, socialLinks: { ...p.socialLinks, tiktok: e.target.value } }))}
                placeholder="https://tiktok.com/@salonheart"
                className="mt-1 text-xs"
              />
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: SEO & META TAGS                                                    */}
      {/* ========================================================================= */}
      {activeTab === 'seo' && (
        <div className="bg-white p-6 rounded-3xl border border-slate-200 space-y-6 shadow-xs max-w-4xl mx-auto">
          <div className="pb-3 border-b border-slate-100">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Search className="w-4 h-4 text-purple-600" />
              <span>Search Engine Optimization (SEO) &amp; OpenGraph</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Control how your salon appears on Google Search and when links are shared on WhatsApp or Facebook.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <Label className="text-xs font-semibold text-slate-700">SEO Page Title</Label>
              <Input
                value={draft.seo.title || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, seo: { ...p.seo, title: e.target.value } }))}
                placeholder="e.g. Salon Heart | Best Bridal Dressing & Hair Stylists in Colombo"
                className="mt-1 text-xs"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Recommended length: 50-60 characters</span>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Meta Description</Label>
              <Textarea
                rows={3}
                value={draft.seo.description || ''}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  updateDraft((p) => ({ ...p, seo: { ...p.seo, description: e.target.value } }))
                }
                placeholder="Discover premier bridal dressing, haircuts, and spa treatments at Salon Heart Colombo. Book your appointment today."
                className="mt-1 text-xs leading-relaxed"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">Recommended length: 140-160 characters</span>
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">Search Keywords (comma-separated)</Label>
              <Input
                value={draft.seo.keywords || ''}
                onChange={(e) => updateDraft((p) => ({ ...p, seo: { ...p.seo, keywords: e.target.value } }))}
                placeholder="salon, hair styling, bridal makeup, colombo salon, beauty care"
                className="mt-1 text-xs"
              />
            </div>

            {/* Google Search Result Preview Snippet */}
            <div className="pt-4 border-t border-slate-100 space-y-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 block">
                Google Search Result Preview
              </span>
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 max-w-xl space-y-1">
                <span className="text-xs text-slate-500 truncate block font-mono">{website.publishedUrl}</span>
                <h4 className="text-sm font-bold text-blue-700 hover:underline cursor-pointer">
                  {draft.seo.title || `${draft.branding.title || 'Salon'} | Official Website`}
                </h4>
                <p className="text-xs text-slate-600 line-clamp-2">
                  {draft.seo.description ||
                    draft.branding.tagline ||
                    `Experience bespoke hair styling and beauty treatments at ${draft.branding.title}.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. BOTTOM STICKY ACTION BAR                                               */}
      {/* ========================================================================= */}
      <div className="sticky bottom-4 z-40 bg-white/95 backdrop-blur-md p-4 rounded-3xl border border-slate-200 shadow-xl flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {hasChanges ? (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
              <Clock className="w-3.5 h-3.5" />
              Unsaved draft edits
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
              <Check className="w-3.5 h-3.5" />
              All draft changes saved
            </span>
          )}
          <span className="text-xs text-slate-400 hidden sm:inline">•</span>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Edits are strictly stored as DRAFT until published.
          </span>
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          {hasChanges && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleResetDraft}
              disabled={saving}
              className="text-xs h-9 gap-1 text-slate-600 border-slate-200 hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Discard
            </Button>
          )}

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenPreview}
            className="text-xs h-9 gap-1.5 font-semibold text-slate-700 border-slate-300 hover:bg-slate-50"
          >
            <Eye className="w-3.5 h-3.5 text-purple-600" />
            Preview Draft
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleSaveDraft(false)}
            disabled={saving || !hasChanges}
            className="text-xs h-9 gap-1.5 font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-xs"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'Saving...' : 'Save Draft'}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handlePublish}
            disabled={publishing}
            className="text-xs h-9 gap-1.5 font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
          >
            <Sparkles className="w-3.5 h-3.5" />
            {publishing ? 'Publishing...' : 'Publish Website'}
          </Button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 6. INTERACTIVE DEVICE PREVIEW MODAL                                       */}
      {/* ========================================================================= */}
      <WebsitePreviewModal
        isOpen={previewOpen}
        onClose={() => setPreviewOpen(false)}
        previewUrl={website.previewUrl}
        templateName={currentTemplate?.name || 'Modern Beauty'}
      />
    </div>
  );
}
