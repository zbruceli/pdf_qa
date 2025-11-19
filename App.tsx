/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useEffect, useRef } from 'react';
import { AppStatus, ChatMessage } from './types';
import * as geminiService from './services/geminiService';
import * as configService from './services/configService';
import Spinner from './components/Spinner';
import WelcomeScreen from './components/WelcomeScreen';
import ProgressBar from './components/ProgressBar';
import ChatInterface from './components/ChatInterface';
import UploadModal from './components/UploadModal';

const App: React.FC = () => {
    const [status, setStatus] = useState<AppStatus>(AppStatus.Initializing);
    const [apiKeyError, setApiKeyError] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<{ current: number, total: number, message?: string, fileName?: string } | null>(null);
    const [activeRagStoreName, setActiveRagStoreName] = useState<string | null>(null);
    const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
    const [isQueryLoading, setIsQueryLoading] = useState(false);
    const [exampleQuestions, setExampleQuestions] = useState<string[]>([]);
    const [documentName, setDocumentName] = useState<string>('');
    const [files, setFiles] = useState<File[]>([]);
    const [isConfigLoading, setIsConfigLoading] = useState(true);
    const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
    const ragStoreNameRef = useRef(activeRagStoreName);

    useEffect(() => {
        ragStoreNameRef.current = activeRagStoreName;
    }, [activeRagStoreName]);
    
    useEffect(() => {
        try {
            geminiService.initialize();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to initialize Gemini with the configured API key.";
            setApiKeyError(message);
        }

        const loadPersistedStore = async () => {
            try {
                const storedStore = await configService.getStoredRagStoreName();
                if (storedStore) {
                    setActiveRagStoreName(storedStore);
                    const label = storedStore.split('/').pop() || storedStore;
                    setDocumentName(prev => prev || `Existing Session (${label})`);
                    setStatus(AppStatus.Chatting);
                } else {
                    setStatus(AppStatus.Welcome);
                }
            } catch (err) {
                console.error("Failed to load stored RAG store", err);
                setStatus(AppStatus.Welcome);
            } finally {
                setIsConfigLoading(false);
            }
        };

        loadPersistedStore();
    }, []);
    

    const handleError = (message: string, err: any) => {
        console.error(message, err);
        setError(`${message}${err ? `: ${err instanceof Error ? err.message : String(err)}` : ''}`);
        setStatus(AppStatus.Error);
    };

    const clearError = () => {
        setError(null);
        setStatus(AppStatus.Welcome);
    }


    const ensureRagStore = async (): Promise<string> => {
        if (activeRagStoreName) {
            return activeRagStoreName;
        }
        const storeName = `chat-session-${Date.now()}`;
        const ragStoreName = await geminiService.createRagStore(storeName);
        setActiveRagStoreName(ragStoreName);
        try {
            await configService.saveRagStoreName(ragStoreName);
        } catch (err) {
            console.error("Failed to persist RAG store name", err);
        }
        return ragStoreName;
    };

    const describeFiles = (fileList: File[]): string => {
        if (fileList.length === 1) {
            return fileList[0].name;
        }
        if (fileList.length === 2) {
            return `${fileList[0].name} & ${fileList[1].name}`;
        }
        return `${fileList.length} documents`;
    };

    const handleUploadAndStartChat = async (incomingFiles?: File[], options: { resetChat?: boolean } = {}) => {
        const filesToUpload = incomingFiles ?? files;
        if (filesToUpload.length === 0) return;
        const resetChat = options.resetChat ?? true;
        
        setApiKeyError(null);

        try {
            geminiService.initialize();
        } catch (err) {
            const message = err instanceof Error ? err.message : "Failed to initialize Gemini with the configured API key.";
            setApiKeyError(message);
            setStatus(AppStatus.Welcome);
            throw err;
        }
        
        const isNewStore = !activeRagStoreName;
        setStatus(AppStatus.Uploading);
        const totalSteps = filesToUpload.length + 2;
        setUploadProgress({ current: 0, total: totalSteps, message: isNewStore ? "Creating document index..." : "Updating document index..." });

        try {
            const ragStoreName = await ensureRagStore();
            
            setUploadProgress({ current: 1, total: totalSteps, message: "Generating embeddings..." });

            for (let i = 0; i < filesToUpload.length; i++) {
                setUploadProgress(prev => ({ 
                    ...(prev!),
                    current: i + 1,
                    message: "Generating embeddings...",
                    fileName: `(${i + 1}/${filesToUpload.length}) ${filesToUpload[i].name}`
                }));
                await geminiService.uploadToRagStore(ragStoreName, filesToUpload[i]);
            }
            
            setUploadProgress({ current: filesToUpload.length + 1, total: totalSteps, message: "Generating suggestions...", fileName: "" });
            const questions = await geminiService.generateExampleQuestions(ragStoreName);
            setExampleQuestions(questions);

            setUploadProgress({ current: totalSteps, total: totalSteps, message: "All set!", fileName: "" });
            
            await new Promise(resolve => setTimeout(resolve, 500)); // Short delay to show "All set!"

            if (resetChat) {
                setDocumentName(describeFiles(filesToUpload));
                setChatHistory([]);
            }

            setStatus(AppStatus.Chatting);
            if (!incomingFiles) {
                setFiles([]);
            }
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message.toLowerCase() : String(err).toLowerCase();
            if (errorMessage.includes('api key not valid') || errorMessage.includes('requested entity was not found')) {
                setApiKeyError("The Gemini API key from .env.local is invalid. Update GEMINI_API_KEY and restart the app.");
                setStatus(AppStatus.Welcome);
            } else {
                handleError("Failed to process documents", err);
            }
            throw err;
        } finally {
            setUploadProgress(null);
        }
    };

    const handleEndChat = () => {
        setChatHistory([]);
        setExampleQuestions([]);
        setDocumentName('');
        setFiles([]);
        setStatus(AppStatus.Welcome);
    };

    const handleResumeChat = () => {
        setChatHistory([]);
        setExampleQuestions([]);
        if (!documentName && activeRagStoreName) {
            const label = activeRagStoreName.split('/').pop() || activeRagStoreName;
            setDocumentName(`Existing Session (${label})`);
        }
        setStatus(AppStatus.Chatting);
    };

    const handleAdditionalFileUpload = async (newFiles: File[]) => {
        if (newFiles.length === 0) return;
        try {
            await handleUploadAndStartChat(newFiles, { resetChat: false });
        } catch (error) {
            console.error("Failed to upload additional files", error);
        }
    };

    const handleSendMessage = async (message: string) => {
        if (!activeRagStoreName) return;

        const userMessage: ChatMessage = { role: 'user', parts: [{ text: message }] };
        setChatHistory(prev => [...prev, userMessage]);
        setIsQueryLoading(true);

        try {
            const result = await geminiService.fileSearch(activeRagStoreName, message);
            const modelMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: result.text }],
                groundingChunks: result.groundingChunks
            };
            setChatHistory(prev => [...prev, modelMessage]);
        } catch (err) {
            const errorMessage: ChatMessage = {
                role: 'model',
                parts: [{ text: "Sorry, I encountered an error. Please try again." }]
            };
            setChatHistory(prev => [...prev, errorMessage]);
            handleError("Failed to get response", err);
        } finally {
            setIsQueryLoading(false);
        }
    };
    
    const renderContent = () => {
        if (status === AppStatus.Initializing || isConfigLoading) {
            return (
                <div className="flex items-center justify-center h-screen">
                    <Spinner /> <span className="ml-4 text-xl">Loading saved session...</span>
                </div>
            );
        }

        switch(status) {
            case AppStatus.Welcome:
                 return (
                    <WelcomeScreen 
                        onUpload={() => handleUploadAndStartChat()}
                        apiKeyError={apiKeyError}
                        files={files}
                        setFiles={setFiles}
                        ragStoreName={activeRagStoreName}
                        onResumeChat={activeRagStoreName ? handleResumeChat : undefined}
                    />
                 );
            case AppStatus.Uploading:
                let icon = null;
                if (uploadProgress?.message === "Creating document index...") {
                    icon = <img src="https://services.google.com/fh/files/misc/applet-upload.png" alt="Uploading files icon" className="h-80 w-80 rounded-lg object-cover" />;
                } else if (uploadProgress?.message === "Generating embeddings...") {
                    icon = <img src="https://services.google.com/fh/files/misc/applet-creating-embeddings_2.png" alt="Creating embeddings icon" className="h-240 w-240 rounded-lg object-cover" />;
                } else if (uploadProgress?.message === "Generating suggestions...") {
                    icon = <img src="https://services.google.com/fh/files/misc/applet-suggestions_2.png" alt="Generating suggestions icon" className="h-240 w-240 rounded-lg object-cover" />;
                } else if (uploadProgress?.message === "All set!") {
                    icon = <img src="https://services.google.com/fh/files/misc/applet-completion_2.png" alt="Completion icon" className="h-240 w-240 rounded-lg object-cover" />;
                }

                return <ProgressBar 
                    progress={uploadProgress?.current || 0} 
                    total={uploadProgress?.total || 1} 
                    message={uploadProgress?.message || "Preparing your chat..."} 
                    fileName={uploadProgress?.fileName}
                    icon={icon}
                />;
            case AppStatus.Chatting:
                return <ChatInterface 
                    documentName={documentName || 'Your Documents'}
                    history={chatHistory}
                    isQueryLoading={isQueryLoading}
                    onSendMessage={handleSendMessage}
                    onNewChat={handleEndChat}
                    exampleQuestions={exampleQuestions}
                    storeName={activeRagStoreName}
                    onAddFiles={() => setIsUploadModalOpen(true)}
                />;
            case AppStatus.Error:
                 return (
                    <div className="flex flex-col items-center justify-center h-screen bg-red-900/20 text-red-300">
                        <h1 className="text-3xl font-bold mb-4">Application Error</h1>
                        <p className="max-w-md text-center mb-4">{error}</p>
                        <button onClick={clearError} className="px-4 py-2 rounded-md bg-gem-mist hover:bg-gem-mist/70 transition-colors" title="Return to the welcome screen">
                           Try Again
                        </button>
                    </div>
                );
            default:
                 return (
                    <WelcomeScreen 
                        onUpload={() => handleUploadAndStartChat()}
                        apiKeyError={apiKeyError}
                        files={files}
                        setFiles={setFiles}
                        ragStoreName={activeRagStoreName}
                        onResumeChat={activeRagStoreName ? handleResumeChat : undefined}
                    />
                 );
        }
    }

    return (
        <main className="h-screen bg-gem-onyx text-gem-offwhite">
            {renderContent()}
            <UploadModal 
                isOpen={isUploadModalOpen}
                onClose={() => setIsUploadModalOpen(false)}
                onUpload={async (selectedFiles) => {
                    setIsUploadModalOpen(false);
                    await handleAdditionalFileUpload(selectedFiles);
                }}
            />
        </main>
    );
};

export default App;
