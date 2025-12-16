'use client';

import React, { useState } from 'react';
import { Category } from './types';

interface CategoryManagerProps {
  categories: Category[];
  onCategoryCreate: (category: Omit<Category, 'id'>) => void;
  onCategoryUpdate: (id: string, category: Partial<Category>) => void;
  onCategoryDelete: (id: string) => void;
}

/**
 * CategoryManager Component
 * 
 * Manages expense categories and their classification rules.
 * 
 * Requirements: 3.5
 */
export const CategoryManager: React.FC<CategoryManagerProps> = ({
  categories,
  onCategoryCreate,
  onCategoryUpdate,
  onCategoryDelete,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newCategory, setNewCategory] = useState({
    name: '',
    color: '#3B82F6',
    icon: '📁',
    keywords: '',
    merchantPatterns: '',
    bucketMapping: 'spendable' as const,
  });

  const handleCreate = () => {
    if (!newCategory.name.trim()) return;

    const category: Omit<Category, 'id'> = {
      name: newCategory.name.trim(),
      color: newCategory.color,
      icon: newCategory.icon,
      keywords: newCategory.keywords.split(',').map(k => k.trim()).filter(Boolean),
      merchantPatterns: newCategory.merchantPatterns
        .split(',')
        .map(p => p.trim())
        .filter(Boolean)
        .map(p => new RegExp(p, 'i')),
      bucketMapping: newCategory.bucketMapping,
      isDefault: false,
    };

    onCategoryCreate(category);
    setNewCategory({
      name: '',
      color: '#3B82F6',
      icon: '📁',
      keywords: '',
      merchantPatterns: '',
      bucketMapping: 'spendable',
    });
    setIsCreating(false);
  };

  return (
    <div className="w-full space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold text-gray-900">Expense Categories</h2>
        <button
          onClick={() => setIsCreating(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
        >
          Add Category
        </button>
      </div>

      {/* Create New Category Form */}
      {isCreating && (
        <div className="bg-white p-6 rounded-lg shadow-sm border">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Category</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Category Name *
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={newCategory.name}
                onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                placeholder="e.g., Office Supplies"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Icon
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={newCategory.icon}
                onChange={(e) => setNewCategory({ ...newCategory, icon: e.target.value })}
                placeholder="📁"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Color
              </label>
              <input
                type="color"
                className="w-full h-10 border border-gray-300 rounded-md"
                value={newCategory.color}
                onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bucket Mapping
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={newCategory.bucketMapping}
                onChange={(e) => setNewCategory({ ...newCategory, bucketMapping: e.target.value as any })}
              >
                <option value="bills">Bills</option>
                <option value="savings">Savings</option>
                <option value="growth">Growth</option>
                <option value="spendable">Spendable</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Keywords (comma-separated)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={newCategory.keywords}
                onChange={(e) => setNewCategory({ ...newCategory, keywords: e.target.value })}
                placeholder="office, supplies, stationery"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Merchant Patterns (comma-separated regex)
              </label>
              <input
                type="text"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={newCategory.merchantPatterns}
                onChange={(e) => setNewCategory({ ...newCategory, merchantPatterns: e.target.value })}
                placeholder="staples, office depot, amazon"
              />
            </div>
          </div>

          <div className="flex space-x-3 mt-4">
            <button
              onClick={handleCreate}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              Create Category
            </button>
            <button
              onClick={() => setIsCreating(false)}
              className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Categories List */}
      <div className="space-y-2">
        {categories.map((category) => (
          <div
            key={category.id}
            className="bg-white p-4 rounded-lg shadow-sm border flex items-center justify-between"
          >
            <div className="flex items-center space-x-4">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: category.color }}
              ></div>
              <span className="text-lg">{category.icon}</span>
              <div>
                <h3 className="font-medium text-gray-900">{category.name}</h3>
                <p className="text-sm text-gray-600">
                  Maps to: <span className="capitalize">{category.bucketMapping}</span>
                  {category.isDefault && (
                    <span className="ml-2 px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded">
                      Default
                    </span>
                  )}
                </p>
                {category.keywords.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    Keywords: {category.keywords.join(', ')}
                  </p>
                )}
              </div>
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setEditingId(category.id)}
                className="text-blue-600 hover:text-blue-800 text-sm"
              >
                Edit
              </button>
              {!category.isDefault && (
                <button
                  onClick={() => onCategoryDelete(category.id)}
                  className="text-red-600 hover:text-red-800 text-sm"
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>No categories created yet.</p>
          <p className="text-sm mt-1">Create your first category to get started.</p>
        </div>
      )}
    </div>
  );
};