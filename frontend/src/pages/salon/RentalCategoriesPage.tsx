import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  AlertCircle,
  AlertTriangle,
  FolderTree,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Tag,
  Trash2,
  X,
} from 'lucide-react';
import { tenantApi, type RentalCategoryItem } from '@/api/tenant.api';
import { useDebouncedSearch } from '@/hooks/useDebounce';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

export default function RentalCategoriesPage() {
  const qc = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const debouncedSearch = useDebouncedSearch(searchTerm, 350, 1);
  const [statusFilter, setStatusFilter] = useState<'all' | 'ACTIVE' | 'INACTIVE'>('all');

  // Modal states
  const [createOpen, setCreateOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<RentalCategoryItem | null>(null);
  const [deleteCategory, setDeleteCategory] = useState<RentalCategoryItem | null>(null);

  // Form states
  const [categoryName, setCategoryName] = useState('');
  const [categoryCode, setCategoryCode] = useState('');
  const [autoCode, setAutoCode] = useState(true);
  const [categoryDesc, setCategoryDesc] = useState('');
  const [categoryActive, setCategoryActive] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  // Fetch categories
  const {
    data: categories = [],
    isLoading,
    refetch,
    isRefetching,
  } = useQuery({
    queryKey: ['rental-categories', debouncedSearch, statusFilter],
    queryFn: () =>
      tenantApi.rentals.listCategories({
        search: debouncedSearch || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      }),
  });

  // Suggest code query when creating
  const { data: suggestedCodeData, refetch: refetchCode } = useQuery({
    queryKey: ['rental-category-suggest-code'],
    queryFn: () => tenantApi.rentals.suggestCategoryCode(),
    enabled: createOpen && autoCode,
  });

  useEffect(() => {
    if (createOpen && autoCode && suggestedCodeData?.code) {
      setCategoryCode(suggestedCodeData.code);
    }
  }, [createOpen, autoCode, suggestedCodeData]);

  const handleOpenCreate = () => {
    setCategoryName('');
    setCategoryCode('');
    setAutoCode(true);
    setCategoryDesc('');
    setCategoryActive(true);
    setFormError(null);
    setCreateOpen(true);
    refetchCode();
  };

  const handleOpenEdit = (cat: RentalCategoryItem) => {
    setEditCategory(cat);
    setCategoryName(cat.name);
    setCategoryCode(cat.code);
    setCategoryDesc(cat.description || '');
    setCategoryActive(cat.isActive);
    setFormError(null);
  };

  // Create mutation
  const createMutation = useMutation({
    mutationFn: (payload: { name: string; code?: string; description?: string }) =>
      tenantApi.rentals.createCategory(payload),
    onSuccess: (newCat) => {
      qc.invalidateQueries({ queryKey: ['rental-categories'] });
      qc.invalidateQueries({ queryKey: ['rental-categories-active'] });
      toast.success(`Rental category "${newCat.name}" created successfully`);
      setCreateOpen(false);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || 'Failed to create category';
      setFormError(msg);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: { name?: string; description?: string; isActive?: boolean };
    }) => tenantApi.rentals.updateCategory(id, payload),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['rental-categories'] });
      qc.invalidateQueries({ queryKey: ['rental-categories-active'] });
      qc.invalidateQueries({ queryKey: ['rental-items'] });
      toast.success(`Rental category "${updated.name}" updated successfully`);
      setEditCategory(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || 'Failed to update category';
      setFormError(msg);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => tenantApi.rentals.deleteCategory(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rental-categories'] });
      qc.invalidateQueries({ queryKey: ['rental-categories-active'] });
      toast.success('Category deleted successfully');
      setDeleteCategory(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err.message || 'Failed to delete category';
      toast.error(msg);
    },
  });

  const handleSaveCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryName.trim()) {
      setFormError('Category name is required');
      return;
    }
    setFormError(null);
    createMutation.mutate({
      name: categoryName.trim(),
      code: autoCode ? undefined : categoryCode.trim() || undefined,
      description: categoryDesc.trim() || undefined,
    });
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editCategory) return;
    if (!categoryName.trim()) {
      setFormError('Category name is required');
      return;
    }
    setFormError(null);
    updateMutation.mutate({
      id: editCategory.id,
      payload: {
        name: categoryName.trim(),
        description: categoryDesc.trim() || undefined,
        isActive: categoryActive,
      },
    });
  };

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/40 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-primary/10 rounded-lg text-primary">
              <Layers className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground">Rental Categories</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Organize your rental wardrobe, jewellery, accessories, and specialty collections.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="h-9 px-3 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', isRefetching && 'animate-spin')} />
            Refresh
          </Button>
          <Button onClick={handleOpenCreate} className="h-9 px-4 gap-2 text-sm font-medium shadow-sm">
            <Plus className="h-4 w-4" />
            Add Category
          </Button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-card border border-border rounded-xl p-3 shadow-xs">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by category name, code, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm bg-background border-border/70"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center bg-muted/60 p-1 rounded-lg border border-border/40 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={cn(
                'px-3 py-1 rounded-md font-medium transition-colors',
                statusFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              All ({categories.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('ACTIVE')}
              className={cn(
                'px-3 py-1 rounded-md font-medium transition-colors',
                statusFilter === 'ACTIVE'
                  ? 'bg-background text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('INACTIVE')}
              className={cn(
                'px-3 py-1 rounded-md font-medium transition-colors',
                statusFilter === 'INACTIVE'
                  ? 'bg-background text-muted-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Inactive
            </button>
          </div>
        </div>
      </div>

      {/* Categories Grid / List */}
      {isLoading ? (
        <div className="py-20 text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
          <p className="mt-3 text-sm text-muted-foreground">Loading rental categories...</p>
        </div>
      ) : categories.length === 0 ? (
        <div className="text-center py-16 bg-card border border-dashed border-border rounded-xl p-8">
          <FolderTree className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-foreground">No Categories Found</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1 mb-4">
            {searchTerm || statusFilter !== 'all'
              ? 'No categories match your current search filters.'
              : 'Create categories to easily classify and organize all your rental items.'}
          </p>
          {!searchTerm && statusFilter === 'all' && (
            <Button onClick={handleOpenCreate} size="sm" className="gap-2">
              <Plus className="h-4 w-4" />
              Add First Category
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-card border border-border rounded-xl p-5 shadow-xs hover:shadow-md transition-shadow flex flex-col justify-between"
            >
              <div>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-mono text-xs px-2 py-0.5 rounded-md bg-muted text-muted-foreground border border-border/60">
                        {cat.code}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                          cat.isActive
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            : 'bg-muted text-muted-foreground border-border',
                        )}
                      >
                        {cat.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <h3 className="text-base font-semibold text-foreground truncate">{cat.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleOpenEdit(cat)}
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Edit Category"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteCategory(cat)}
                      className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      title="Delete Category"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                  {cat.description || <span className="italic text-muted-foreground/60">No description provided</span>}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-xs text-muted-foreground">
                <span className="flex items-center gap-1.5 font-medium text-foreground">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  {cat.itemCount} {cat.itemCount === 1 ? 'item' : 'items'}
                </span>
                <span>Created {new Date(cat.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* CREATE CATEGORY MODAL */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Add Rental Category</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Create a new category to group rental items like bridal wear, suits, or accessories.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveCreate} className="space-y-4 py-2">
            {formError && (
              <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="cat-name" className="text-xs font-semibold">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="cat-name"
                placeholder="e.g. Bridal Sarees, Tuxedos, Headpieces"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="cat-code" className="text-xs font-semibold">
                  Category Code
                </Label>
                <button
                  type="button"
                  onClick={() => setAutoCode(!autoCode)}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  {autoCode ? 'Custom Code' : 'Auto Generate'}
                </button>
              </div>
              <Input
                id="cat-code"
                placeholder="e.g. RCAT-0011"
                value={categoryCode}
                onChange={(e) => setCategoryCode(e.target.value)}
                disabled={autoCode}
                className={cn('h-9 text-sm font-mono', autoCode && 'bg-muted/50 text-muted-foreground')}
              />
              <p className="text-[11px] text-muted-foreground">
                {autoCode ? 'Code will be assigned sequentially automatically.' : 'Enter a unique category code.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="cat-desc" className="text-xs font-semibold">
                Description <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <textarea
                id="cat-desc"
                rows={3}
                placeholder="Brief description of the items included in this category..."
                value={categoryDesc}
                onChange={(e) => setCategoryDesc(e.target.value)}
                className="w-full text-sm rounded-md border border-input bg-background p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={createMutation.isPending}>
                {createMutation.isPending ? 'Saving...' : 'Create Category'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* EDIT CATEGORY MODAL */}
      <Dialog open={!!editCategory} onOpenChange={(open) => !open && setEditCategory(null)}>
        <DialogContent className="sm:max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">Edit Rental Category</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Update category details. Renaming will automatically update all assigned rental items.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSaveEdit} className="space-y-4 py-2">
            {formError && (
              <div className="p-3 text-xs bg-destructive/10 border border-destructive/20 text-destructive rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="edit-cat-name" className="text-xs font-semibold">
                Category Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="edit-cat-name"
                value={categoryName}
                onChange={(e) => setCategoryName(e.target.value)}
                required
                className="h-9 text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Category Code</Label>
              <Input value={categoryCode} disabled className="h-9 text-sm font-mono bg-muted/50 text-muted-foreground" />
              <p className="text-[11px] text-muted-foreground">Category code cannot be changed once created.</p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="edit-cat-desc" className="text-xs font-semibold">
                Description <span className="text-muted-foreground font-normal">(Optional)</span>
              </Label>
              <textarea
                id="edit-cat-desc"
                rows={3}
                value={categoryDesc}
                onChange={(e) => setCategoryDesc(e.target.value)}
                className="w-full text-sm rounded-md border border-input bg-background p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30">
              <div>
                <p className="text-xs font-semibold text-foreground">Active Status</p>
                <p className="text-[11px] text-muted-foreground">Inactive categories will not appear in rental booking item dropdowns</p>
              </div>
              <input
                type="checkbox"
                checked={categoryActive}
                onChange={(e) => setCategoryActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => setEditCategory(null)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DELETE CONFIRMATION MODAL */}
      <Dialog open={!!deleteCategory} onOpenChange={(open) => !open && setDeleteCategory(null)}>
        <DialogContent className="sm:max-w-md w-[95vw]">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Delete Rental Category
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-1">
              Are you sure you want to delete category{' '}
              <strong className="text-foreground font-semibold">"{deleteCategory?.name}"</strong>?
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            {deleteCategory && deleteCategory.itemCount > 0 ? (
              <div className="p-3.5 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-900 dark:text-amber-200 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold text-amber-700 dark:text-amber-300">
                  <AlertCircle className="h-4 w-4" />
                  Cannot Delete Category in Use
                </div>
                <p>
                  This category currently has{' '}
                  <strong>
                    {deleteCategory.itemCount} rental item{deleteCategory.itemCount === 1 ? '' : 's'}
                  </strong>{' '}
                  assigned to it. To protect data integrity, please reassign or delete those items before deleting this category.
                </p>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                This action is permanent and cannot be undone. No rental items are currently assigned to this category.
              </p>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setDeleteCategory(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={!deleteCategory || deleteCategory.itemCount > 0 || deleteMutation.isPending}
              onClick={() => deleteCategory && deleteMutation.mutate(deleteCategory.id)}
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete Category'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

