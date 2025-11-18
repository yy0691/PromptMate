/**
 * 模板市场视图
 * 展示公共提示词市场，支持浏览、搜索、上传、管理
 */

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { marketplaceService, MarketplacePrompt } from '@/services/marketplaceService';
import { 
  Search, 
  Upload, 
  Download, 
  Edit, 
  Trash2, 
  Eye, 
  CheckCircle, 
  XCircle, 
  Clock,
  Tag,
  User,
  Star
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function MarketplaceView({ onToggleSidebar }: { onToggleSidebar?: () => void }) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { user, isAuthenticated } = useAuth();
  
  const [prompts, setPrompts] = useState<MarketplacePrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string>('');
  const [sortBy, setSortBy] = useState<'created_at' | 'download_count' | 'view_count'>('created_at');
  const [sortAscending, setSortAscending] = useState(false);
  
  // 上传/编辑对话框
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<MarketplacePrompt | null>(null);
  const [uploadForm, setUploadForm] = useState({
    title: '',
    content: '',
    description: '',
    category: 'other',
    tags: '',
  });
  
  // 详情对话框
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedPrompt, setSelectedPrompt] = useState<MarketplacePrompt | null>(null);

  // 加载提示词列表
  const loadPrompts = async () => {
    setLoading(true);
    try {
      const data = await marketplaceService.listPrompts({
        search: searchTerm || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        tag: selectedTag || undefined,
        order_by: sortBy,
        ascending: sortAscending,
      });
      setPrompts(data);
    } catch (error: any) {
      toast({
        title: t('marketplace.error.loadFailed'),
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrompts();
  }, [searchTerm, selectedCategory, selectedTag, sortBy, sortAscending]);

  // 获取所有分类
  const categories = useMemo(() => {
    const cats = new Set(prompts.map(p => p.category));
    return Array.from(cats);
  }, [prompts]);

  // 获取所有标签
  const allTags = useMemo(() => {
    const tags = new Set<string>();
    prompts.forEach(p => p.tags.forEach(tag => tags.add(tag)));
    return Array.from(tags);
  }, [prompts]);

  // 打开上传对话框
  const handleOpenUpload = () => {
    if (!isAuthenticated) {
      toast({
        title: t('marketplace.error.loginRequired'),
        description: t('marketplace.error.loginRequiredDesc'),
        variant: 'destructive',
      });
      return;
    }
    setEditingPrompt(null);
    setUploadForm({
      title: '',
      content: '',
      description: '',
      category: 'other',
      tags: '',
    });
    setUploadDialogOpen(true);
  };

  // 打开编辑对话框
  const handleOpenEdit = (prompt: MarketplacePrompt) => {
    setEditingPrompt(prompt);
    setUploadForm({
      title: prompt.title,
      content: prompt.content,
      description: prompt.description || '',
      category: prompt.category,
      tags: prompt.tags.join(', '),
    });
    setUploadDialogOpen(true);
  };

  // 提交上传/编辑
  const handleSubmitPrompt = async () => {
    if (!uploadForm.title || !uploadForm.content) {
      toast({
        title: t('marketplace.error.invalidInput'),
        description: t('marketplace.error.pleaseFillRequired'),
        variant: 'destructive',
      });
      return;
    }

    try {
      const tags = uploadForm.tags.split(',').map(t => t.trim()).filter(t => t);
      
      if (editingPrompt) {
        await marketplaceService.updatePrompt(editingPrompt.id, {
          title: uploadForm.title,
          content: uploadForm.content,
          description: uploadForm.description,
          category: uploadForm.category,
          tags,
        });
        toast({
          title: t('marketplace.success.updated'),
          variant: 'success',
        });
      } else {
        await marketplaceService.createPrompt({
          title: uploadForm.title,
          content: uploadForm.content,
          description: uploadForm.description,
          category: uploadForm.category,
          tags,
        });
        toast({
          title: t('marketplace.success.uploaded'),
          description: t('marketplace.success.pendingReview'),
          variant: 'success',
        });
      }
      
      setUploadDialogOpen(false);
      loadPrompts();
    } catch (error: any) {
      toast({
        title: editingPrompt ? t('marketplace.error.updateFailed') : t('marketplace.error.uploadFailed'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 删除提示词
  const handleDeletePrompt = async (prompt: MarketplacePrompt) => {
    if (!confirm(t('marketplace.confirm.delete'))) {
      return;
    }

    try {
      await marketplaceService.deletePrompt(prompt.id);
      toast({
        title: t('marketplace.success.deleted'),
        variant: 'success',
      });
      loadPrompts();
    } catch (error: any) {
      toast({
        title: t('marketplace.error.deleteFailed'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 下载提示词
  const handleDownloadPrompt = async (prompt: MarketplacePrompt) => {
    try {
      await marketplaceService.downloadPrompt(prompt.id);
      toast({
        title: t('marketplace.success.downloaded'),
        description: t('marketplace.success.addedToLibrary'),
        variant: 'success',
      });
      loadPrompts(); // 刷新列表以更新下载计数
    } catch (error: any) {
      toast({
        title: t('marketplace.error.downloadFailed'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 查看详情
  const handleViewDetail = async (prompt: MarketplacePrompt) => {
    try {
      const detail = await marketplaceService.getPrompt(prompt.id);
      setSelectedPrompt(detail);
      setDetailDialogOpen(true);
    } catch (error: any) {
      toast({
        title: t('marketplace.error.loadFailed'),
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  // 检查是否为提示词所有者
  const isOwner = (prompt: MarketplacePrompt) => {
    return isAuthenticated && user?.id === prompt.user_id;
  };

  // 获取状态图标
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部工具栏 */}
      <div className="flex-shrink-0 p-4 border-b space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">{t('marketplace.title')}</h1>
          <Button onClick={handleOpenUpload} disabled={!isAuthenticated}>
            <Upload className="h-4 w-4 mr-2" />
            {t('marketplace.upload')}
          </Button>
        </div>

        {/* 搜索和筛选 */}
        <div className="flex flex-wrap gap-2">
          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={t('marketplace.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <Select value={selectedCategory} onValueChange={setSelectedCategory}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('marketplace.category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('marketplace.allCategories')}</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedTag} onValueChange={setSelectedTag}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder={t('marketplace.tag')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">{t('marketplace.allTags')}</SelectItem>
              {allTags.map(tag => (
                <SelectItem key={tag} value={tag}>{tag}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[150px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="created_at">{t('marketplace.sortByDate')}</SelectItem>
              <SelectItem value="download_count">{t('marketplace.sortByDownloads')}</SelectItem>
              <SelectItem value="view_count">{t('marketplace.sortByViews')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 提示词列表 */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : prompts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground text-lg">{t('marketplace.noPrompts')}</p>
            <p className="text-muted-foreground text-sm mt-2">{t('marketplace.noPromptsDesc')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {prompts.map((prompt) => (
              <Card key={prompt.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg line-clamp-2">{prompt.title}</CardTitle>
                      {prompt.description && (
                        <CardDescription className="mt-1 line-clamp-2">
                          {prompt.description}
                        </CardDescription>
                      )}
                    </div>
                    {getStatusIcon(prompt.status)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {/* 标签 */}
                    {prompt.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {prompt.tags.slice(0, 3).map(tag => (
                          <Badge key={tag} variant="secondary" className="text-xs">
                            <Tag className="h-3 w-3 mr-1" />
                            {tag}
                          </Badge>
                        ))}
                        {prompt.tags.length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{prompt.tags.length - 3}
                          </Badge>
                        )}
                      </div>
                    )}

                    {/* 统计信息 */}
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Eye className="h-4 w-4" />
                        {prompt.view_count}
                      </div>
                      <div className="flex items-center gap-1">
                        <Download className="h-4 w-4" />
                        {prompt.download_count}
                      </div>
                    </div>

                    <Separator />

                    {/* 操作按钮 */}
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleViewDetail(prompt)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        {t('marketplace.view')}
                      </Button>
                      <Button
                        variant="default"
                        size="sm"
                        className="flex-1"
                        onClick={() => handleDownloadPrompt(prompt)}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        {t('marketplace.download')}
                      </Button>
                      {isOwner(prompt) && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              ...
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleOpenEdit(prompt)}>
                              <Edit className="h-4 w-4 mr-2" />
                              {t('marketplace.edit')}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDeletePrompt(prompt)}
                              className="text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('marketplace.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* 上传/编辑对话框 */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPrompt ? t('marketplace.editPrompt') : t('marketplace.uploadPrompt')}
            </DialogTitle>
            <DialogDescription>
              {editingPrompt ? t('marketplace.editPromptDesc') : t('marketplace.uploadPromptDesc')}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>{t('marketplace.title')} *</Label>
              <Input
                value={uploadForm.title}
                onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                placeholder={t('marketplace.titlePlaceholder')}
              />
            </div>
            <div>
              <Label>{t('marketplace.content')} *</Label>
              <Textarea
                value={uploadForm.content}
                onChange={(e) => setUploadForm({ ...uploadForm, content: e.target.value })}
                placeholder={t('marketplace.contentPlaceholder')}
                rows={8}
              />
            </div>
            <div>
              <Label>{t('marketplace.description')}</Label>
              <Textarea
                value={uploadForm.description}
                onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                placeholder={t('marketplace.descriptionPlaceholder')}
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('marketplace.category')}</Label>
                <Select value={uploadForm.category} onValueChange={(v) => setUploadForm({ ...uploadForm, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creative">{t('marketplace.categoryCreative')}</SelectItem>
                    <SelectItem value="productivity">{t('marketplace.categoryProductivity')}</SelectItem>
                    <SelectItem value="development">{t('marketplace.categoryDevelopment')}</SelectItem>
                    <SelectItem value="education">{t('marketplace.categoryEducation')}</SelectItem>
                    <SelectItem value="business">{t('marketplace.categoryBusiness')}</SelectItem>
                    <SelectItem value="other">{t('marketplace.categoryOther')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{t('marketplace.tags')}</Label>
                <Input
                  value={uploadForm.tags}
                  onChange={(e) => setUploadForm({ ...uploadForm, tags: e.target.value })}
                  placeholder={t('marketplace.tagsPlaceholder')}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button onClick={handleSubmitPrompt}>
                {editingPrompt ? t('common.save') : t('marketplace.upload')}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* 详情对话框 */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedPrompt && (
            <>
              <DialogHeader>
                <DialogTitle>{selectedPrompt.title}</DialogTitle>
                <DialogDescription>{selectedPrompt.description}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>{t('marketplace.content')}</Label>
                  <div className="mt-2 p-4 bg-muted rounded-md whitespace-pre-wrap">
                    {selectedPrompt.content}
                  </div>
                </div>
                {selectedPrompt.tags.length > 0 && (
                  <div>
                    <Label>{t('marketplace.tags')}</Label>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {selectedPrompt.tags.map(tag => (
                        <Badge key={tag} variant="secondary">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between pt-4 border-t">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Eye className="h-4 w-4" />
                      {selectedPrompt.view_count} {t('marketplace.views')}
                    </div>
                    <div className="flex items-center gap-1">
                      <Download className="h-4 w-4" />
                      {selectedPrompt.download_count} {t('marketplace.downloads')}
                    </div>
                  </div>
                  <Button onClick={() => handleDownloadPrompt(selectedPrompt)}>
                    <Download className="h-4 w-4 mr-2" />
                    {t('marketplace.download')}
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

