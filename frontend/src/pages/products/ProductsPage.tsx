import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { api } from "../../api/client";
import { useTenantStore } from "../../stores/tenantStore";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Card, CardContent } from "../../components/ui/Card";
import { Modal } from "../../components/ui/Modal";
import { Badge } from "../../components/ui/Badge";
import { PageLoader } from "../../components/ui/Spinner";
import { formatCurrency } from "../../lib/utils";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Package, Search, AlertCircle } from "lucide-react";

interface Variant { id: string; name: string; sku: string; price: string; costPrice: string; isActive: boolean; }
interface Category { id: string; name: string; }
interface Product {
    id: string; name: string; description?: string; isActive: boolean;
    category?: Category; variants: Variant[];
}

const productSchema = z.object({
    name: z.string().min(1, "Name is required"),
    description: z.string().optional(),
    categoryId: z.string().optional(),
});
const variantSchema = z.object({
    name: z.string().min(1, "Name is required"),
    sku: z.string().min(2, "SKU must be at least 2 characters"),
    price: z.string()
        .min(1, "Price is required")
        .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, { message: "Price must be greater than 0" }),
    costPrice: z.string()
        .optional()
        .refine((v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), { message: "Cost must be 0 or more" }),
});

type ProductForm = z.infer<typeof productSchema>;
type VariantForm = z.infer<typeof variantSchema>;

export default function ProductsPage() {
    const { currentTenant } = useTenantStore();
    const qc = useQueryClient();
    const tid = currentTenant?.id;

    const [productModal, setProductModal] = useState<{ open: boolean; product?: Product }>({ open: false });
    const [variantModal, setVariantModal] = useState<{ open: boolean; productId?: string; variant?: Variant }>({ open: false });
    const [expanded, setExpanded] = useState<Record<string, boolean>>({});
    const [pendingDeleteProduct, setPendingDeleteProduct] = useState<Product | null>(null);
    const [pendingDeleteVariant, setPendingDeleteVariant] = useState<{ product: Product; variant: Variant } | null>(null);
    const [search, setSearch] = useState("");

    const { data: products = [], isLoading } = useQuery<Product[]>({
        queryKey: ["products", tid],
        queryFn: () => api.get(`/api/tenants/${tid}/products`).then((r) => r.data),
        enabled: !!tid,
    });

    const { data: categories = [] } = useQuery<Category[]>({
        queryKey: ["categories", tid],
        queryFn: () => api.get(`/api/tenants/${tid}/categories`).then((r) => r.data),
        enabled: !!tid,
    });

    const pForm = useForm<ProductForm>({ resolver: zodResolver(productSchema) });
    const vForm = useForm<VariantForm>({ resolver: zodResolver(variantSchema) });

    const saveProduct = useMutation({
        mutationFn: (data: ProductForm) => productModal.product
            ? api.patch(`/api/tenants/${tid}/products/${productModal.product.id}`, data)
            : api.post(`/api/tenants/${tid}/products`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["products", tid] }); setProductModal({ open: false }); pForm.reset(); },
    });

    const doDeleteProduct = useMutation({
        mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/products/${id}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["products", tid] }); setPendingDeleteProduct(null); },
    });

    const saveVariant = useMutation({
        mutationFn: (data: VariantForm) => variantModal.variant
            ? api.patch(`/api/tenants/${tid}/products/${variantModal.productId}/variants/${variantModal.variant.id}`, data)
            : api.post(`/api/tenants/${tid}/products/${variantModal.productId}/variants`, data),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["products", tid] }); setVariantModal({ open: false }); vForm.reset(); },
    });

    const doDeleteVariant = useMutation({
        mutationFn: ({ pid, vid }: { pid: string; vid: string }) =>
            api.delete(`/api/tenants/${tid}/products/${pid}/variants/${vid}`),
        onSuccess: () => { qc.invalidateQueries({ queryKey: ["products", tid] }); setPendingDeleteVariant(null); },
    });

    const openProductModal = (product?: Product) => {
        pForm.reset(product ? { name: product.name, description: product.description, categoryId: product.category?.id } : {});
        setProductModal({ open: true, product });
    };

    const openVariantModal = (productId: string, variant?: Variant) => {
        vForm.reset(variant ? { name: variant.name, sku: variant.sku, price: variant.price, costPrice: variant.costPrice } : {});
        setVariantModal({ open: true, productId, variant });
    };

    const filtered = useMemo(
        () => products.filter((p) =>
            p.name.toLowerCase().includes(search.toLowerCase()) ||
            (p.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
            (p.category?.name ?? "").toLowerCase().includes(search.toLowerCase())
        ),
        [products, search]
    );

    if (isLoading) return <PageLoader />;

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Products</h1>
                    <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                        {products.length} product{products.length !== 1 ? "s" : ""}
                    </p>
                </div>
                <Button onClick={() => openProductModal()} className="gap-2 self-start sm:self-auto">
                    <Plus className="w-4 h-4" /> Add product
                </Button>
            </div>

            {/* Search bar */}
            {products.length > 0 && (
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Search by name, description or category…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-primary-500 dark:focus:border-primary-400 focus:ring-1 focus:ring-primary-500/20"
                    />
                </div>
            )}

            {/* Products list */}
            {products.length === 0 ? (
                <Card>
                    <CardContent className="py-16 text-center">
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                            <Package className="w-6 h-6 text-gray-400" />
                        </div>
                        <p className="text-gray-900 dark:text-white font-medium mb-1">No products yet</p>
                        <p className="text-gray-400 dark:text-gray-500 text-sm mb-4">Start building your catalog by adding your first product</p>
                        <Button onClick={() => openProductModal()}>Add your first product</Button>
                    </CardContent>
                </Card>
            ) : filtered.length === 0 ? (
                <Card>
                    <CardContent className="py-12 text-center">
                        <p className="text-gray-500 dark:text-gray-400">No products match &ldquo;{search}&rdquo;</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="space-y-2.5">
                    {filtered.map((p) => (
                        <Card key={p.id}>
                            {/* Product header */}
                            <div
                                className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors rounded-lg"
                                onClick={() => setExpanded((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
                            >
                                <div className="flex items-center gap-3 min-w-0">
                                    {expanded[p.id]
                                        ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                        : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                                    <div className="w-8 h-8 rounded bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center flex-shrink-0">
                                        <Package className="w-4 h-4 text-primary-500 dark:text-primary-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <p className="font-medium text-gray-900 dark:text-white">{p.name}</p>
                                            {!p.isActive && <Badge variant="warning">Inactive</Badge>}
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                            {p.category && <Badge variant="info">{p.category.name}</Badge>}
                                            <span className="text-xs text-gray-400 dark:text-gray-500">
                        {p.variants.length} variant{p.variants.length !== 1 ? "s" : ""}
                      </span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1 flex-shrink-0 ml-2" onClick={(e) => e.stopPropagation()}>
                                    <Button variant="ghost" size="sm" onClick={() => openProductModal(p)}>
                                        <Pencil className="w-4 h-4" />
                                    </Button>
                                    <Button variant="ghost" size="sm" onClick={() => setPendingDeleteProduct(p)}>
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </Button>
                                </div>
                            </div>

                            {/* Expanded variants */}
                            {expanded[p.id] && (
                                <div className="border-t border-gray-100 dark:border-gray-800">
                                    <div className="flex items-center justify-between px-4 sm:px-6 py-3">
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Variants</p>
                                        <Button size="sm" variant="outline" onClick={() => openVariantModal(p.id)}>
                                            <Plus className="w-3.5 h-3.5 mr-1" /> Add variant
                                        </Button>
                                    </div>

                                    {p.variants.length === 0 ? (
                                        <p className="px-4 sm:px-6 pb-4 text-sm text-gray-400">No variants yet. Add one above.</p>
                                    ) : (
                                        <>
                                            {/* Desktop variant table */}
                                            <div className="hidden sm:block overflow-x-auto px-6 pb-4">
                                                <table className="w-full text-sm">
                                                    <thead>
                                                    <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800">
                                                        <th className="pb-2 text-xs font-medium uppercase tracking-wide">Name</th>
                                                        <th className="pb-2 text-xs font-medium uppercase tracking-wide">SKU</th>
                                                        <th className="pb-2 text-xs font-medium uppercase tracking-wide">Price</th>
                                                        <th className="pb-2 text-xs font-medium uppercase tracking-wide">Cost</th>
                                                        <th className="pb-2" />
                                                    </tr>
                                                    </thead>
                                                    <tbody>
                                                    {p.variants.map((v) => (
                                                        <tr key={v.id} className="border-b border-gray-50 dark:border-gray-800/50 last:border-0">
                                                            <td className="py-2.5 font-medium text-gray-900 dark:text-white">{v.name}</td>
                                                            <td className="py-2.5">
                                  <span className="font-mono text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                                    {v.sku}
                                  </span>
                                                            </td>
                                                            <td className="py-2.5 font-medium text-gray-900 dark:text-white">{formatCurrency(v.price)}</td>
                                                            <td className="py-2.5 text-gray-500 dark:text-gray-400">{formatCurrency(v.costPrice)}</td>
                                                            <td className="py-2.5">
                                                                <div className="flex items-center gap-1 justify-end">
                                                                    <Button variant="ghost" size="sm" onClick={() => openVariantModal(p.id, v)}>
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </Button>
                                                                    <Button variant="ghost" size="sm" onClick={() => setPendingDeleteVariant({ product: p, variant: v })}>
                                                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                                    </Button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    </tbody>
                                                </table>
                                            </div>

                                            {/* Mobile variant cards */}
                                            <div className="sm:hidden divide-y divide-gray-100 dark:divide-gray-800 pb-2">
                                                {p.variants.map((v) => (
                                                    <div key={v.id} className="px-4 py-3 flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="font-medium text-gray-900 dark:text-white text-sm">{v.name}</p>
                                                            <p className="font-mono text-xs text-gray-500 dark:text-gray-400 mt-0.5">{v.sku}</p>
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <span className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(v.price)}</span>
                                                                {v.costPrice && (
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400">Cost: {formatCurrency(v.costPrice)}</span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1 flex-shrink-0">
                                                            <Button variant="ghost" size="sm" onClick={() => openVariantModal(p.id, v)}>
                                                                <Pencil className="w-3.5 h-3.5" />
                                                            </Button>
                                                            <Button variant="ghost" size="sm" onClick={() => setPendingDeleteVariant({ product: p, variant: v })}>
                                                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </Card>
                    ))}
                </div>
            )}

            {/* Product modal */}
            <Modal open={productModal.open} onClose={() => setProductModal({ open: false })} title={productModal.product ? "Edit product" : "Add product"}>
                <form onSubmit={pForm.handleSubmit((d) => saveProduct.mutate(d))} className="flex flex-col gap-4">
                    <Input
                        label="Name"
                        placeholder="e.g. iPhone 15 Pro"
                        {...pForm.register("name")}
                        error={pForm.formState.errors.name?.message}
                    />
                    <Input
                        label="Description"
                        placeholder="Optional product description"
                        {...pForm.register("description")}
                    />
                    <Select label="Category" {...pForm.register("categoryId")}>
                        <option value="">No category</option>
                        {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </Select>
                    <div className="flex gap-3 justify-end pt-1">
                        <Button type="button" variant="outline" onClick={() => setProductModal({ open: false })}>Cancel</Button>
                        <Button type="submit" loading={saveProduct.isPending}>Save</Button>
                    </div>
                </form>
            </Modal>

            {/* Variant modal */}
            <Modal open={variantModal.open} onClose={() => setVariantModal({ open: false })} title={variantModal.variant ? "Edit variant" : "Add variant"}>
                <form onSubmit={vForm.handleSubmit((d) => saveVariant.mutate(d))} className="flex flex-col gap-4">
                    <Input
                        label="Variant name"
                        placeholder="e.g. Red / Large"
                        {...vForm.register("name")}
                        error={vForm.formState.errors.name?.message}
                    />
                    <Input
                        label="SKU"
                        placeholder="e.g. PROD-001-RED-L"
                        {...vForm.register("sku")}
                        error={vForm.formState.errors.sku?.message}
                        helperText="Unique identifier for this variant (min. 2 characters)"
                    />
                    <div className="grid grid-cols-2 gap-3">
                        <Input
                            label="Selling price"
                            type="number"
                            step="0.01"
                            min="0.01"
                            placeholder="0.00"
                            {...vForm.register("price")}
                            error={vForm.formState.errors.price?.message}
                        />
                        <Input
                            label="Cost price"
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                            {...vForm.register("costPrice")}
                            error={vForm.formState.errors.costPrice?.message}
                            helperText="Optional"
                        />
                    </div>
                    <div className="flex gap-3 justify-end pt-1">
                        <Button type="button" variant="outline" onClick={() => setVariantModal({ open: false })}>Cancel</Button>
                        <Button type="submit" loading={saveVariant.isPending}>Save</Button>
                    </div>
                </form>
            </Modal>

            {/* Delete product confirmation */}
            <Modal open={!!pendingDeleteProduct} onClose={() => setPendingDeleteProduct(null)} title="Delete product" size="sm">
                <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Delete &ldquo;{pendingDeleteProduct?.name}&rdquo;?
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                This will permanently delete the product and all its variants. This action cannot be undone.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <Button type="button" variant="outline" onClick={() => setPendingDeleteProduct(null)}>Cancel</Button>
                        <Button
                            variant="danger"
                            loading={doDeleteProduct.isPending}
                            onClick={() => pendingDeleteProduct && doDeleteProduct.mutate(pendingDeleteProduct.id)}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Delete variant confirmation */}
            <Modal open={!!pendingDeleteVariant} onClose={() => setPendingDeleteVariant(null)} title="Delete variant" size="sm">
                <div className="flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center flex-shrink-0">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Delete variant &ldquo;{pendingDeleteVariant?.variant.name}&rdquo;?
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                                This action cannot be undone. Any inventory records for this variant will also be removed.
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-3 justify-end">
                        <Button type="button" variant="outline" onClick={() => setPendingDeleteVariant(null)}>Cancel</Button>
                        <Button
                            variant="danger"
                            loading={doDeleteVariant.isPending}
                            onClick={() => pendingDeleteVariant && doDeleteVariant.mutate({
                                pid: pendingDeleteVariant.product.id,
                                vid: pendingDeleteVariant.variant.id,
                            })}
                        >
                            Delete
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}