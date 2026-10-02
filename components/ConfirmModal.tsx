import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    isDestructive = true
}) => {
    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="bg-white dark:bg-[#221210] rounded-2xl shadow-2xl p-6 max-w-sm w-full border border-gray-100 dark:border-[#3a201d]"
                    >
                        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">{title}</h3>
                        <p className="text-gray-600 dark:text-gray-300 mb-6 text-sm whitespace-pre-wrap">{message}</p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={onCancel}
                                className="px-4 py-2 text-sm font-bold text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#3a201d] rounded-lg transition-colors"
                            >
                                {cancelText}
                            </button>
                            <button
                                onClick={onConfirm}
                                className={`px-4 py-2 text-sm font-bold text-white rounded-lg transition-colors shadow-sm ${
                                    isDestructive 
                                        ? 'bg-red-500 hover:bg-red-600' 
                                        : 'bg-primary hover:bg-primary-hover'
                                }`}
                            >
                                {confirmText}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
