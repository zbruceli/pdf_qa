/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useCallback } from 'react';
import UploadCloudIcon from './icons/UploadCloudIcon';
import TrashIcon from './icons/TrashIcon';

interface UploadModalProps {
    isOpen: boolean;
    onClose: () => void;
    onUpload: (files: File[]) => void;
}

const UploadModal: React.FC<UploadModalProps> = ({ isOpen, onClose, onUpload }) => {
    const [files, setFiles] = useState<File[]>([]);
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        if (event.target.files) {
            setFiles(prev => [...prev, ...Array.from(event.target.files)]);
        }
    };

    const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
        if (event.dataTransfer.files) {
            setFiles(prev => [...prev, ...Array.from(event.dataTransfer.files)]);
        }
    }, []);

    const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        if (!isDragging) {
            setIsDragging(true);
        }
    }, [isDragging]);

    const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
        event.preventDefault();
        event.stopPropagation();
        setIsDragging(false);
    }, []);

    const handleRemoveFile = (index: number) => {
        setFiles(prev => prev.filter((_, i) => i !== index));
    };

    const handleConfirm = () => {
        if (files.length === 0) return;
        onUpload(files);
        setFiles([]);
    };

    const handleClose = () => {
        setFiles([]);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" role="dialog" aria-modal="true" aria-labelledby="add-files-title">
            <div className="bg-gem-slate p-6 rounded-xl shadow-2xl w-full max-w-2xl">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h3 id="add-files-title" className="text-2xl font-bold">Add Documents to This Store</h3>
                        <p className="text-sm text-gem-offwhite/70">Uploaded files will be added to your current Gemini File Search store.</p>
                    </div>
                    <button onClick={handleClose} className="text-gem-offwhite/60 hover:text-gem-offwhite text-2xl leading-none" aria-label="Close upload modal">
                        &times;
                    </button>
                </div>

                <div
                    className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${isDragging ? 'border-gem-blue bg-gem-mist/10' : 'border-gem-mist/50'}`}
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                >
                    <div className="flex flex-col items-center justify-center">
                        <UploadCloudIcon />
                        <p className="mt-3 text-lg text-gem-offwhite/80">Drag & drop more PDF, .txt, or .md files.</p>
                        <input id="add-files-input" type="file" multiple className="hidden" onChange={handleFileChange} accept=".pdf,.txt,.md" />
                        <label
                            htmlFor="add-files-input"
                            className="mt-4 cursor-pointer px-5 py-2 bg-gem-blue text-white rounded-full font-semibold hover:bg-blue-500 transition-colors focus:outline-none focus:ring-2 focus:ring-gem-blue"
                            tabIndex={0}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    (document.getElementById('add-files-input') as HTMLInputElement)?.click();
                                }
                            }}
                        >
                            Browse Files
                        </label>
                    </div>
                </div>

                {files.length > 0 && (
                    <div className="mt-6">
                        <h4 className="font-semibold mb-2">Ready to upload ({files.length}):</h4>
                        <ul className="space-y-2 max-h-48 overflow-y-auto pr-2">
                            {files.map((file, index) => (
                                <li key={`${file.name}-${index}`} className="flex justify-between items-center bg-gem-mist/30 rounded-lg px-3 py-2 text-sm">
                                    <div className="flex flex-col truncate">
                                        <span className="truncate" title={file.name}>{file.name}</span>
                                        <span className="text-xs text-gem-offwhite/60">{(file.size / 1024).toFixed(2)} KB</span>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveFile(index)}
                                        className="text-red-400 hover:text-red-300 p-1 rounded-full"
                                        aria-label={`Remove ${file.name}`}
                                        title="Remove this file"
                                    >
                                        <TrashIcon />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="flex justify-end space-x-3 mt-6">
                    <button
                        onClick={handleClose}
                        className="px-4 py-2 rounded-md border border-gem-mist/70 text-gem-offwhite/80 hover:bg-gem-mist/10 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleConfirm}
                        disabled={files.length === 0}
                        className="px-4 py-2 rounded-md bg-gem-blue text-white font-semibold disabled:bg-gem-mist/40 disabled:cursor-not-allowed"
                    >
                        Upload Files
                    </button>
                </div>
            </div>
        </div>
    );
};

export default UploadModal;
