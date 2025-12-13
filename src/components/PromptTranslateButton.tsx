import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger
} from '@/components/ui/collapsible';
import { Prompt } from '@/types';
import { usePromptTranslation } from '@/hooks/usePromptTranslation';
import { useTranslation } from 'react-i18next';
import {
    Languages,
    ChevronDown,
    ChevronRight,
    Loader2,
    Edit3,
    RefreshCw,
    Copy,
    Check
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PromptTranslateButtonProps {
    prompt: Prompt;
    onTranslateComplete: (translatedContent: string, contentLanguage: 'zh' | 'en') => void;
    onManualEdit?: (translatedContent: string) => void;
    className?: string;
}

export function PromptTranslateButton({
    prompt,
    onTranslateComplete,
    onManualEdit,
    className
}: PromptTranslateButtonProps) {
    const { t } = useTranslation();
    const {
        translatePrompt,
        isTranslating,
        streamingContent,
        detectLanguage
    } = usePromptTranslation();

    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editContent, setEditContent] = useState(prompt.translatedContent || '');
    const [copied, setCopied] = useState(false);

    const detectedLanguage = detectLanguage(prompt.content);
    const targetLanguage: 'zh' | 'en' = detectedLanguage === 'zh' ? 'en' : 'zh';
    const hasTranslation = !!prompt.translatedContent;

    const handleTranslate = async () => {
        const result = await translatePrompt(
            prompt,
            targetLanguage,
            (translatedContent) => {
                onTranslateComplete(translatedContent, detectedLanguage);
                setEditContent(translatedContent);
            },
            true // 使用流式输出
        );
    };

    const handleSaveManualEdit = () => {
        if (editContent.trim()) {
            onManualEdit?.(editContent);
            onTranslateComplete(editContent, detectedLanguage);
            setIsEditing(false);
        }
    };

    const handleCopyTranslation = async () => {
        if (prompt.translatedContent) {
            await navigator.clipboard.writeText(prompt.translatedContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const displayContent = isTranslating ? streamingContent : (prompt.translatedContent || '');

    return (
        <div className={cn("space-y-2", className)}>
            {/* 翻译按钮 */}
            <div className="flex items-center gap-2">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            disabled={isTranslating}
                            className="gap-2"
                        >
                            {isTranslating ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Languages className="h-4 w-4" />
                            )}
                            {hasTranslation ? t('translation.retranslate') : t('translation.translate')}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start">
                        <DropdownMenuItem onClick={handleTranslate}>
                            <Languages className="h-4 w-4 mr-2" />
                            {t('translation.aiTranslate')} ({targetLanguage === 'en' ? 'English' : '中文'})
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setIsEditing(true)}>
                            <Edit3 className="h-4 w-4 mr-2" />
                            {t('translation.manualInput')}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>

                {hasTranslation && (
                    <span className="text-xs text-muted-foreground">
                        {t('translation.translatedAt', {
                            time: prompt.translatedAt
                                ? new Date(prompt.translatedAt).toLocaleDateString()
                                : ''
                        })}
                    </span>
                )}
            </div>

            {/* 翻译内容显示区域 */}
            {(hasTranslation || isTranslating || isEditing) && (
                <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
                    <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="gap-1 p-0 h-auto">
                            {isExpanded ? (
                                <ChevronDown className="h-4 w-4" />
                            ) : (
                                <ChevronRight className="h-4 w-4" />
                            )}
                            <span className="text-sm font-medium">
                                {t('translation.translatedContent')}
                            </span>
                        </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="mt-2">
                        {isEditing ? (
                            <div className="space-y-2">
                                <Textarea
                                    value={editContent}
                                    onChange={(e) => setEditContent(e.target.value)}
                                    placeholder={t('translation.manualInputPlaceholder')}
                                    rows={6}
                                    className="resize-none"
                                />
                                <div className="flex gap-2">
                                    <Button size="sm" onClick={handleSaveManualEdit}>
                                        {t('common.save')}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                            setIsEditing(false);
                                            setEditContent(prompt.translatedContent || '');
                                        }}
                                    >
                                        {t('common.cancel')}
                                    </Button>
                                </div>
                            </div>
                        ) : (
                            <div className="relative">
                                <div className="p-3 bg-muted rounded-md text-sm whitespace-pre-wrap">
                                    {displayContent || t('translation.noContent')}
                                    {isTranslating && (
                                        <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-1" />
                                    )}
                                </div>

                                {hasTranslation && !isTranslating && (
                                    <div className="absolute top-2 right-2 flex gap-1">
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={() => setIsEditing(true)}
                                        >
                                            <Edit3 className="h-3 w-3" />
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={handleCopyTranslation}
                                        >
                                            {copied ? (
                                                <Check className="h-3 w-3 text-green-500" />
                                            ) : (
                                                <Copy className="h-3 w-3" />
                                            )}
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6"
                                            onClick={handleTranslate}
                                        >
                                            <RefreshCw className="h-3 w-3" />
                                        </Button>
                                    </div>
                                )}
                            </div>
                        )}
                    </CollapsibleContent>
                </Collapsible>
            )}
        </div>
    );
}
