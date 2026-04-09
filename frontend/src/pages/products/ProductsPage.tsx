import { useState } from "react";
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
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";

interface Variant { id: string; name: string; sku: string; price: string; costPrice: string; isActive: boolean; }
interface Category { id: string; name: string; }
interface Product {
  id: string; name: string; description?: string; isActive: boolean;
  category?: Category; variants: Variant[];
}

const productSchema = z.object({
  name: z.string().min(1, "Name required"),
  description: z.string().optional(),
  categoryId: z.string().optional(),
});
const variantSchema = z.object({
  name: z.string().min(1, "Name required"),
  sku: z.string().min(1, "SKU required"),
  price: z.string().min(1, "Price required"),
  costPrice: z.string().optional(),
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

  const deleteProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/products/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", tid] }),
  });

  const saveVariant = useMutation({
    mutationFn: (data: VariantForm) => variantModal.variant
      ? api.patch(`/api/tenants/${tid}/products/${variantModal.productId}/variants/${variantModal.variant.id}`, data)
      : api.post(`/api/tenants/${tid}/products/${variantModal.productId}/variants`, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["products", tid] }); setVariantModal({ open: false }); vForm.reset(); },
  });

  const deleteVariant = useMutation({
    mutationFn: ({ pid, vid }: { pid: string; vid: string }) => api.delete(`/api/tenants/${tid}/products/${pid}/variants/${vid}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["products", tid] }),
  });

  const openProductModal = (product?: Product) => {
    pForm.reset(product ? { name: product.name, description: product.description, categoryId: product.category?.id } : {});
    setProductModal({ open: true, product });
  };

  const openVariantModal = (productId: string, variant?: Variant) => {
    vForm.reset(variant ? { name: variant.name, sku: variant.sku, price: variant.price, costPrice: variant.costPrice } : {});
    setVariantModal({ open: true, productId, variant });
  };

  if (isLoading) return <PageLoader />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-500 text-sm mt-1">{products.length} products</p>
        </div>
        <Button onClick={() => openProductModal()} className="gap-2">
          <Plus className="w-4 h-4" /> Add product
        </Button>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="text-gray-400 mb-4">No products yet</p>
            <Button onClick={() => openProductModal()}>Add your first product</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {products.map((p) => (
            <Card key={p.id}>
              <div
                className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-gray-50 transition-colors"
                onClick={() => setExpanded((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
              >
                <div className="flex items-center gap-3">
                  {expanded[p.id] ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                  <div>
                    <p className="font-medium text-gray-900">{p.name}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {p.category && <Badge variant="info">{p.category.name}</Badge>}
                      <span className="text-xs text-gray-400">{p.variants.length} variant{p.variants.length !== 1 ? "s" : ""}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Button variant="ghost" size="sm" onClick={() => openProductModal(p)}>
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete this product?")) deleteProduct.mutate(p.id); }}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </div>

              {expanded[p.id] && (
                <div className="border-t border-gray-100 px-6 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-sm font-medium text-gray-700">Variants</p>
                    <Button size="sm" variant="outline" onClick={() => openVariantModal(p.id)}>
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add variant
                    </Button>
                  </div>
                  {p.variants.length === 0 ? (
                    <p className="text-sm text-gray-400">No variants. Add one above.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-gray-500 border-b border-gray-100">
                            <th className="pb-2 font-medium">Name</th>
                            <th className="pb-2 font-medium">SKU</th>
                            <th className="pb-2 font-medium">Price</th>
                            <th className="pb-2 font-medium">Cost</th>
                            <th className="pb-2" />
                          </tr>
                        </thead>
                        <tbody>
                          {p.variants.map((v) => (
                            <tr key={v.id} className="border-b border-gray-50">
                              <td className="py-2 font-medium">{v.name}</td>
                              <td className="py-2 text-gray-500 font-mono text-xs">{v.sku}</td>
                              <td className="py-2">{formatCurrency(v.price)}</td>
                              <td className="py-2 text-gray-500">{formatCurrency(v.costPrice)}</td>
                              <td className="py-2">
                                <div className="flex items-center gap-1 justify-end">
                                  <Button variant="ghost" size="sm" onClick={() => openVariantModal(p.id, v)}>
                                    <Pencil className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => { if (confirm("Delete variant?")) deleteVariant.mutate({ pid: p.id, vid: v.id }); }}>
                                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
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
          <Input label="Name" {...pForm.register("name")} error={pForm.formState.errors.name?.message} />
          <Input label="Description" {...pForm.register("description")} />
          <Select label="Category" {...pForm.register("categoryId")}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setProductModal({ open: false })}>Cancel</Button>
            <Button type="submit" loading={saveProduct.isPending}>Save</Button>
          </div>
        </form>
      </Modal>

      {/* Variant modal */}
      <Modal open={variantModal.open} onClose={() => setVariantModal({ open: false })} title={variantModal.variant ? "Edit variant" : "Add variant"}>
        <form onSubmit={vForm.handleSubmit((d) => saveVariant.mutate(d))} className="flex flex-col gap-4">
          <Input label="Variant name" placeholder="e.g. Red / Large" {...vForm.register("name")} error={vForm.formState.errors.name?.message} />
          <Input label="SKU" placeholder="e.g. PROD-001-RED-L" {...vForm.register("sku")} error={vForm.formState.errors.sku?.message} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Selling price" type="number" step="0.01" {...vForm.register("price")} error={vForm.formState.errors.price?.message} />
            <Input label="Cost price" type="number" step="0.01" {...vForm.register("costPrice")} />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button type="button" variant="outline" onClick={() => setVariantModal({ open: false })}>Cancel</Button>
            <Button type="submit" loading={saveVariant.isPending}>Save</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
