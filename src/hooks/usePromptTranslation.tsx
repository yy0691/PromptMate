import { useState, useCallback } from 'react';
import { Prompt } from '@/types';
import {
    aiService,
    AITranslateResponse,
    BatchTranslateCallback
} from '@/services/aiService';
import { useToast } from '@/hooks/use-toast';
import { useTranslation } from 'react-i18next';

interface TranslationState {
    isTranslating: boolean;
    error: string | null;
    streamingContent: string;
}

interface BatchTranslationState {
    isTranslating: boolean;
    progress: number;
    total: number;
    currentPromptId: string | null;
    errors: Map<string, string>;
}

export function usePromptTranslation() {
    const { toast } = useToast();
    const { t } = useTranslation();

    const [state, setState] = useState<TranslationState>({
        isTranslating: false,
        error: null,
        streamingContent: ''
    });

    const [batchState, setBatchState] = useState<BatchTranslationState>({
        isTranslating: false,
        progress: 0,
        total: 0,
        currentPromptId: null,
        errors: new Map()
    });

    const [abortController, setAbortController] = useState<AbortController | null>(null);

    // 单个翻译
    const translatePrompt = useCallback(async (
        prompt: Prompt,
        targetLanguage: 'zh' | 'en',
        onUpdate: (translatedContent: string) => void,
        useStreaming: boolean = true
    ): Promise<AITranslateResponse | null> => {
        if (!aiService.isConfigured()) {
            toast({
                title: t('translation.error'),
                description: t('translation.aiNotConfigured'),
                variant: 'destructive'
            });
            return null;
        }

        setState({
            isTranslating: true,
            error: null,
            streamingContent: ''
        });

        try {
            const result = await aiService.translatePrompt(
                {
                    content: prompt.content,
                    targetLanguage,
                    title: prompt.title
                },
                useStreaming ? {
                    onChunk: (chunk) => {
                        setState(prev => ({
                            ...prev,
                            streamingContent: prev.streamingContent + chunk
                        }));
                    },
                    onComplete: (fullResponse) => {
                        onUpdate(fullResponse);
                        setState({
                            isTranslating: false,
                            error: null,
                            streamingContent: ''
                        });
                    },
                    onError: (error) => {
                        setState({
                            isTranslating: false,
                            error: error.message,
                            streamingContent: ''
                        });
                    }
                } : undefined
            );

            if (!useStreaming) {
                onUpdate(result.translatedContent);
                setState({
                    isTranslating: false,
                    error: null,
                    streamingContent: ''
                });
            }

            toast({
                title: t('translation.success'),
                description: t('translation.successDescription'),
                variant: 'success'
            });

            return result;
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : t('translation.unknownError');
            setState({
                isTranslating: false,
                error: errorMessage,
                streamingContent: ''
            });

            toast({
                title: t('translation.error'),
                description: errorMessage,
                variant: 'destructive'
            });

            return null;
        }
    }, [toast, t]);

    // 批量翻译
    const translatePromptsBatch = useCallback(async (
        prompts: Prompt[],
        targetLanguage: 'zh' | 'en',
        onItemUpdate: (promptId: string, translatedContent: string) => void
    ): Promise<void> => {
        if (!aiService.isConfigured()) {
            toast({
                title: t('translation.error'),
                description: t('translation.aiNotConfigured'),
                variant: 'destructive'
            });
            return;
        }

        const controller = new AbortController();
        setAbortController(controller);

        setBatchState({
            isTranslating: true,
            progress: 0,
            total: prompts.length,
            currentPromptId: null,
            errors: new Map()
        });

        const callback: BatchTranslateCallback = {
            onProgress: (current, total, promptId) => {
                setBatchState(prev => ({
                    ...prev,
                    progress: current,
                    total,
                    currentPromptId: promptId
                }));
            },
            onItemComplete: (promptId, result) => {
                onItemUpdate(promptId, result.translatedContent);
            },
            onError: (promptId, error) => {
                setBatchState(prev => ({
                    ...prev,
                    errors: new Map(prev.errors).set(promptId, error.message)
                }));
            },
            onComplete: (results) => {
                setBatchState(prev => ({
                    ...prev,
                    isTranslating: false,
                    currentPromptId: null
                }));

                const successCount = results.size;
                const errorCount = prompts.length - successCount;

                if (errorCount === 0) {
                    toast({
                        title: t('translation.batchSuccess'),
                        description: t('translation.batchSuccessDescription', { count: successCount }),
                        variant: 'success'
                    });
                } else {
                    toast({
                        title: t('translation.batchPartial'),
                        description: t('translation.batchPartialDescription', {
                            success: successCount,
                            error: errorCount
                        }),
                        variant: 'warning'
                    });
                }

                setAbortController(null);
            }
        };

        const promptsToTranslate = prompts.map(p => ({
            id: p.id,
            content: p.content
        }));

        await aiService.translatePromptsBatch(
            promptsToTranslate,
            targetLanguage,
            callback,
            controller.signal
        );
    }, [toast, t]);

    // 中断批量翻译
    const abortBatchTranslation = useCallback(() => {
        if (abortController) {
            abortController.abort();
            setAbortController(null);

            setBatchState(prev => ({
                ...prev,
                isTranslating: false,
                currentPromptId: null
            }));

            toast({
                title: t('translation.aborted'),
                description: t('translation.abortedDescription'),
                variant: 'warning'
            });
        }
    }, [abortController, toast, t]);

    // 检测语言
    const detectLanguage = useCallback((content: string): 'zh' | 'en' => {
        const chineseCharCount = (content.match(/[\u4e00-\u9fff]/g) || []).length;
        const totalCharCount = content.replace(/\s/g, '').length;
        return chineseCharCount > totalCharCount * 0.3 ? 'zh' : 'en';
    }, []);

    return {
        // 单个翻译
        translatePrompt,
        isTranslating: state.isTranslating,
        translationError: state.error,
        streamingContent: state.streamingContent,

        // 批量翻译
        translatePromptsBatch,
        abortBatchTranslation,
        batchState,

        // 工具函数
        detectLanguage
    };
}
