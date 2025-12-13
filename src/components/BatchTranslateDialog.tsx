import React, { useState, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Prompt } from '@/types';
import { usePromptTranslation } from '@/hooks/usePromptTranslation';
import { useTranslation } from 'react-i18next';
import { Languages, Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';

interface BatchTranslateDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    prompts: Prompt[];
    onTranslateComplete: (promptId: string, translatedContent: string, contentLanguage: 'zh' | 'en') => void;
}

export function BatchTranslateDialog({
    open,
    onOpenChange,
    prompts,
    onTranslateComplete
}: BatchTranslateDialogProps) {
    const { t } = useTranslation();
    const {
        translatePromptsBatch,
        abortBatchTranslation,
        batchState,
        detectLanguage
    } = usePromptTranslation();

    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [targetLanguage, setTargetLanguage] = useState<'zh' | 'en'>('en');
    const [completedIds, setCompletedIds] = useState<Set<string>>(new Set());
    const [errorIds, setErrorIds] = useState<Set<string>>(new Set());

    // 筛选未翻译或需要重新翻译的提示词
    const translatablePrompts = useMemo(() => {
        return prompts.filter(p => {
            const detectedLang = detectLanguage(p.content);
            return detectedLang !== targetLanguage;
        });
    }, [prompts, targetLanguage, detectLanguage]);

    const handleSelectAll = () => {
        if (selectedIds.size === translatablePrompts.length) {
            setSelectedIds(new Set());
        } else {
            setSelectedIds(new Set(translatablePrompts.map(p => p.id)));
        }
    };

    const handleToggleSelect = (id: string) => {
        const newSelected = new Set(selectedIds);
        if (newSelected.has(id)) {
            newSelected.delete(id);
        } else {
            newSelected.add(id);
        }
        setSelectedIds(newSelected);
    };

    const handleStartTranslation = async () => {
        const selectedPrompts = prompts.filter(p => selectedIds.has(p.id));

        setCompletedIds(new Set());
        setErrorIds(new Set());

        await translatePromptsBatch(
            selectedPrompts,
            targetLanguage,
            (promptId, translatedContent) => {
                const prompt = prompts.find(p => p.id === promptId);
                if (prompt) {
                    const detectedLang = detectLanguage(prompt.content);
                    onTranslateComplete(promptId, translatedContent, detectedLang);
                    setCompletedIds(prev => new Set(prev).add(promptId));
                }
            }
        );
    };

    const handleClose = () => {
        if (batchState.isTranslating) {
            abortBatchTranslation();
        }
        setSelectedIds(new Set());
        setCompletedIds(new Set());
        setErrorIds(new Set());
        onOpenChange(false);
    };

    const progressPercent = batchState.total > 0
        ? (batchState.progress / batchState.total) * 100
        : 0;

    return (
        <Dialog open={open} onOpenChange={handleClose}>
            <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Languages className="h-5 w-5" />
                        {t('translation.batchTranslate')}
                    </DialogTitle>
                    <DialogDescription>
                        {t('translation.batchTranslateDescription')}
                    </DialogDescription>
                </DialogHeader>

                {/* 目标语言选择 */}
                <div className="flex items-center gap-4 py-2">
                    <span className="text-sm font-medium">{t('translation.targetLanguage')}:</span>
                    <div className="flex gap-2">
                        <Button
                            variant={targetLanguage === 'en' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTargetLanguage('en')}
                            disabled={batchState.isTranslating}
                        >
                            English
                        </Button>
                        <Button
                            variant={targetLanguage === 'zh' ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setTargetLanguage('zh')}
                            disabled={batchState.isTranslating}
                        >
                            中文
                        </Button>
                    </div>
                </div>

                {/* 进度条 */}
                {batchState.isTranslating && (
                    <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                            <span>{t('translation.translating')}...</span>
                            <span>{batchState.progress} / {batchState.total}</span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                    </div>
                )}

                {/* 提示词列表 */}
                <ScrollArea className="flex-1 max-h-[400px] border rounded-md">
                    <div className="p-2">
                        {/* 全选 */}
                        <div className="flex items-center gap-2 p-2 border-b mb-2">
                            <Checkbox
                                checked={selectedIds.size === translatablePrompts.length && translatablePrompts.length > 0}
                                onCheckedChange={handleSelectAll}
                                disabled={batchState.isTranslating}
                            />
                            <span className="text-sm font-medium">
                                {t('common.selectAll')} ({selectedIds.size}/{translatablePrompts.length})
                            </span>
                        </div>

                        {/* 提示词项目 */}
                        {translatablePrompts.length === 0 ? (
                            <div className="p-4 text-center text-muted-foreground">
                                <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                                <p>{t('translation.noPromptsToTranslate')}</p>
                            </div>
                        ) : (
                            translatablePrompts.map(prompt => {
                                const isCompleted = completedIds.has(prompt.id);
                                const hasError = errorIds.has(prompt.id);
                                const isCurrent = batchState.currentPromptId === prompt.id;

                                return (
                                    <div
                                        key={prompt.id}
                                        className={`flex items-center gap-2 p-2 rounded hover:bg-muted/50 ${isCurrent ? 'bg-primary/10' : ''
                                            }`}
                                    >
                                        <Checkbox
                                            checked={selectedIds.has(prompt.id)}
                                            onCheckedChange={() => handleToggleSelect(prompt.id)}
                                            disabled={batchState.isTranslating}
                                        />

                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium truncate">
                                                    {prompt.title}
                                                </span>
                                                {prompt.translatedContent && (
                                                    <Badge variant="secondary" className="text-xs">
                                                        {t('translation.hasTranslation')}
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {prompt.content.substring(0, 100)}...
                                            </p>
                                        </div>

                                        <div className="flex-shrink-0">
                                            {isCurrent && (
                                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                                            )}
                                            {isCompleted && !isCurrent && (
                                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                            )}
                                            {hasError && !isCurrent && (
                                                <XCircle className="h-4 w-4 text-red-500" />
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </ScrollArea>

                <DialogFooter>
                    {batchState.isTranslating ? (
                        <Button variant="destructive" onClick={abortBatchTranslation}>
                            {t('translation.abort')}
                        </Button>
                    ) : (
                        <>
                            <Button variant="outline" onClick={handleClose}>
                                {t('common.close')}
                            </Button>
                            <Button
                                onClick={handleStartTranslation}
                                disabled={selectedIds.size === 0}
                            >
                                <Languages className="h-4 w-4 mr-2" />
                                {t('translation.startTranslate')} ({selectedIds.size})
                            </Button>
                        </>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
