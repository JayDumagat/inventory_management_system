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
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";
import { formatCurrency, cn, resolveImageUrl } from "../../lib/utils";
import { useToast } from "../../hooks/useToast";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight, Package, Search, AlertCircle, SlidersHorizontal, X, ImagePlus, Image } from "lucide-react";

interface Variant { id: string; name: string; sku: string; barcode?: string | null; price: string; costPrice: string; isActive: boolean; }
interface Category { id: string; name: string; }
interface Unit { id: string; name: string; abbreviation: string; }
interface AttributeOption { id: string; value: string; sortOrder: number; }
interface Attribute { id: string; name: string; sortOrder: number; options: AttributeOption[]; }
interface ProductImage { id: string; objectName: string; url: string; altText?: string; sortOrder: number; }
interface Product {
  id: string; name: string; description?: string; isActive: boolean; type?: string;
  category?: Category; unit?: Unit; variants: Variant[]; images?: ProductImage[];
}

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  categoryId: z.string().optional(),
  unitId: z.string().optional(),
  type: z.enum(["physical", "digital", "service", "bundle"]).optional(),
});
const variantSchema = z.object({
  name: z.string().min(1, "Name is required"),
  sku: z.string().min(2, "SKU must be at least 2 characters"),
  barcode: z.string().optional(),
  price: z.string()
    .min(1, "Price is required")
    .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0, { message: "Price must be greater than 0" }),
  costPrice: z.string()
    .optional()
    .refine((v) => !v || (!isNaN(parseFloat(v)) && parseFloat(v) >= 0), { message: "Cost must be 0 or more" }),
});

type ProductForm = z.infer<typeof productSchema>;
type VariantForm = z.infer<typeof variantSchema>;

function ProductThumbnail({ src, alt }: { src?: string; alt: string }) {
  const [error, setError] = useState(false);
  const resolved = resolveImageUrl(src);
  if (!resolved || error) return <Package className="w-4 h-4 text-primary-500" />;
  return <img src={resolved} alt={alt} className="w-full h-full object-cover" onError={() => setError(true)} />;
}

function ImageWithFallback({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [error, setError] = useState(false);
  const resolved = resolveImageUrl(src);
  if (!resolved || error) return <Image className="w-8 h-8 text-muted" />;
  return <img src={resolved} alt={alt} className={className} onError={() => setError(true)} />;
}

export default function ProductsPage() {
  const { currentTenant } = useTenantStore();
  const qc = useQueryClient();
  const tid = currentTenant?.id;
  const toast = useToast();

  const [productModal, setProductModal] = useState<{ open: boolean; product?: Product }>({ open: false });
  const [variantModal, setVariantModal] = useState<{ open: boolean; productId?: string; variant?: Variant }>({ open: false });
  const [attrModal, setAttrModal] = useState<{ open: boolean; product?: Product }>({ open: false });
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [pendingDeleteProduct, setPendingDeleteProduct] = useState<Product | null>(null);
  const [pendingDeleteVariant, setPendingDeleteVariant] = useState<{ product: Product; variant: Variant } | null>(null);
  const [search, setSearch] = useState("");
  const [productStep, setProductStep] = useState<1 | 2>(1);
  const [isAddingProduct, setIsAddingProduct] = useState(false);

  // Attribute management state
  const [attrProductId, setAttrProductId] = useState<string | null>(null);
  const [attrList, setAttrList] = useState<Attribute[]>([]);
  const [newAttrName, setNewAttrName] = useState("");
  const [newOptionValues, setNewOptionValues] = useState<Record<string, string>>({});
  const [attrLoading, setAttrLoading] = useState(false);
  const [imageModal, setImageModal] = useState<{ open: boolean; product?: Product }>({ open: false });
  const [imageList, setImageList] = useState<ProductImage[]>([]);
  const [imageUploading, setImageUploading] = useState(false);
  const [formImages, setFormImages] = useState<File[]>([]);
  const [formImagePreviews, setFormImagePreviews] = useState<string[]>([]);
  const [editImages, setEditImages] = useState<ProductImage[]>([]);
  const [editNewImages, setEditNewImages] = useState<File[]>([]);
  const [editNewPreviews, setEditNewPreviews] = useState<string[]>([]);

  const { data: products = [], isLoading, isError } = useQuery<Product[]>({
    queryKey: ["products", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/products`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ["categories", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/categories`).then((r) => r.data),
    enabled: !!tid,
  });

  const { data: units = [] } = useQuery<Unit[]>({
    queryKey: ["units", tid],
    queryFn: () => api.get(`/api/tenants/${tid}/units`).then((r) => r.data),
    enabled: !!tid,
  });

  const pForm = useForm<ProductForm>({ resolver: zodResolver(productSchema), defaultValues: { type: "physical" } });
  const vForm = useForm<VariantForm>({ resolver: zodResolver(variantSchema) });

  const saveProduct = useMutation({
    mutationFn: async (data: ProductForm) => {
      if (!productModal.product) return;
      await api.patch(`/api/tenants/${tid}/products/${productModal.product.id}`, data);
      if (editNewImages.length > 0) {
        await uploadFilesToProduct(productModal.product.id, editNewImages, editImages.length);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", tid] });
      closeProductModal();
      toast.success("Product updated");
    },
    onError: () => toast.error("Failed to save product"),
  });

  const doDeleteProduct = useMutation({
    mutationFn: (id: string) => api.delete(`/api/tenants/${tid}/products/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", tid] });
      setPendingDeleteProduct(null);
      toast.success("Product deleted");
    },
    onError: () => toast.error("Failed to delete product"),
  });

  const saveVariant = useMutation({
    mutationFn: (data: VariantForm) => variantModal.variant
      ? api.patch(`/api/tenants/${tid}/products/${variantModal.productId}/variants/${variantModal.variant.id}`, data)
      : api.post(`/api/tenants/${tid}/products/${variantModal.productId}/variants`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", tid] });
      setVariantModal({ open: false });
      vForm.reset();
      toast.success(variantModal.variant ? "Variant updated" : "Variant created");
    },
    onError: () => toast.error("Failed to save variant"),
  });

  const doDeleteVariant = useMutation({
    mutationFn: ({ pid, vid }: { pid: string; vid: string }) =>
      api.delete(`/api/tenants/${tid}/products/${pid}/variants/${vid}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["products", tid] });
      setPendingDeleteVariant(null);
      toast.success("Variant deleted");
    },
    onError: () => toast.error("Failed to delete variant"),
  });

  const closeProductModal = () => {
    setProductModal({ open: false });
    pForm.reset();
    vForm.reset();
    setProductStep(1);
    setFormImages([]);
    formImagePreviews.forEach((u) => URL.revokeObjectURL(u));
    setFormImagePreviews([]);
    setEditImages([]);
    setEditNewImages([]);
    editNewPreviews.forEach((u) => URL.revokeObjectURL(u));
    setEditNewPreviews([]);
  };

  const openProductModal = (product?: Product) => {
    pForm.reset(product ? { name: product.name, description: product.description, categoryId: product.category?.id, unitId: product.unit?.id, type: (product.type as "physical" | "digital" | "service" | "bundle") ?? "physical" } : { type: "physical" });
    vForm.reset();
    setProductModal({ open: true, product });
    setProductStep(1);
    setFormImages([]);
    setFormImagePreviews([]);
    if (product) {
      setEditImages(product.images ?? []);
      setEditNewImages([]);
      setEditNewPreviews([]);
    } else {
      setEditImages([]);
      setEditNewImages([]);
      setEditNewPreviews([]);
    }
  };

  const openVariantModal = (productId: string, variant?: Variant) => {
    vForm.reset(variant ? { name: variant.name, sku: variant.sku, barcode: variant.barcode ?? "", price: variant.price, costPrice: variant.costPrice } : {});
    setVariantModal({ open: true, productId, variant });
  };

  const openAttrModal = async (product: Product) => {
    setAttrProductId(product.id);
    setAttrModal({ open: true, product });
    setAttrLoading(true);
    try {
      const res = await api.get(`/api/tenants/${tid}/products/${product.id}/attributes`);
      setAttrList(res.data);
    } finally {
      setAttrLoading(false);
    }
  };

  const openImageModal = (product: Product) => {
    setImageModal({ open: true, product });
    setImageList(product.images ?? []);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !imageModal.product) return;

    setImageUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        if (file.size > 10 * 1024 * 1024) {
          toast.error(`${file.name} exceeds 10 MB limit`);
          continue;
        }

        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // Upload to MinIO
        const uploadRes = await api.post(`/api/tenants/${tid}/uploads`, {
          filename: file.name,
          mimeType: file.type,
          base64,
        });

        // Attach to product
        const imageRes = await api.post(`/api/tenants/${tid}/products/${imageModal.product.id}/images`, {
          objectName: uploadRes.data.objectName,
          url: uploadRes.data.url,
          altText: file.name,
          sortOrder: imageList.length + i,
        });

        setImageList((prev) => [...prev, imageRes.data]);
      }
      qc.invalidateQueries({ queryKey: ["products", tid] });
      toast.success("Image(s) uploaded");
    } catch {
      toast.error("Failed to upload image");
    } finally {
      setImageUploading(false);
      e.target.value = "";
    }
  };

  const handleDeleteImage = async (image: ProductImage) => {
    if (!imageModal.product) return;
    try {
      await api.delete(`/api/tenants/${tid}/products/${imageModal.product.id}/images/${image.id}`);
      setImageList((prev) => prev.filter((i) => i.id !== image.id));
      qc.invalidateQueries({ queryKey: ["products", tid] });
      toast.success("Image deleted");
    } catch {
      toast.error("Failed to delete image");
    }
  };

  const goToProductStep2 = pForm.handleSubmit(() => setProductStep(2));

  const handleFormImageSelect = (e: React.ChangeEvent<HTMLInputElement>, mode: "add" | "edit") => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const validFiles: File[] = [];
    const previews: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} is not an image`);
        continue;
      }
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`${file.name} exceeds 10 MB limit`);
        continue;
      }
      validFiles.push(file);
      previews.push(URL.createObjectURL(file));
    }
    if (mode === "add") {
      setFormImages((prev) => [...prev, ...validFiles]);
      setFormImagePreviews((prev) => [...prev, ...previews]);
    } else {
      setEditNewImages((prev) => [...prev, ...validFiles]);
      setEditNewPreviews((prev) => [...prev, ...previews]);
    }
    e.target.value = "";
  };

  const removeFormImage = (index: number) => {
    URL.revokeObjectURL(formImagePreviews[index]);
    setFormImages((prev) => prev.filter((_, i) => i !== index));
    setFormImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeEditNewImage = (index: number) => {
    URL.revokeObjectURL(editNewPreviews[index]);
    setEditNewImages((prev) => prev.filter((_, i) => i !== index));
    setEditNewPreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const removeEditExistingImage = async (image: ProductImage) => {
    if (!productModal.product) return;
    try {
      await api.delete(`/api/tenants/${tid}/products/${productModal.product.id}/images/${image.id}`);
      setEditImages((prev) => prev.filter((i) => i.id !== image.id));
    } catch (error) {
      console.error("Failed to delete image:", error);
      toast.error("Failed to delete image");
    }
  };

  const uploadFilesToProduct = async (productId: string, files: File[], startIndex: number) => {
    const results = await Promise.allSettled(
      files.map(async (file, i) => {
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            resolve(result.split(",")[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        const uploadRes = await api.post(`/api/tenants/${tid}/uploads`, {
          filename: file.name,
          mimeType: file.type,
          base64,
        });
        await api.post(`/api/tenants/${tid}/products/${productId}/images`, {
          objectName: uploadRes.data.objectName,
          url: uploadRes.data.url,
          altText: file.name,
          sortOrder: startIndex + i,
        });
      })
    );
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      toast.error(`${failed.length} image(s) failed to upload`);
    }
  };

  const handleAddProductSubmit = async () => {
    const pData = pForm.getValues();
    const vData = vForm.getValues();
    const hasVariant = !!(vData.name || vData.sku || vData.price);

    if (hasVariant) {
      const vValid = await vForm.trigger();
      if (!vValid) return;
    }

    setIsAddingProduct(true);
    try {
      const productRes = await api.post(`/api/tenants/${tid}/products`, pData);
      const productId = productRes.data.id;

      if (formImages.length > 0) {
        await uploadFilesToProduct(productId, formImages, 0);
      }

      if (hasVariant) {
        await api.post(`/api/tenants/${tid}/products/${productId}/variants`, vData);
      }

      qc.invalidateQueries({ queryKey: ["products", tid] });
      closeProductModal();
      toast.success("Product created");
    } catch {
      toast.error("Failed to create product");
    } finally {
      setIsAddingProduct(false);
    }
  };

  const filtered = useMemo(
    () => products.filter((p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.category?.name ?? "").toLowerCase().includes(search.toLowerCase())
    ),
    [products, search]
  );

  if (isLoading) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-32" />
      </div>
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}
    </div>
  );

  if (isError) return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <h1 className="text-2xl font-bold text-ink">Products</h1>
        <Button onClick={() => openProductModal()} className="gap-2 self-start sm:self-auto">
          <Plus className="w-4 h-4" /> Add product
        </Button>
      </div>
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
          <p className="text-sm font-medium text-ink mb-1">Failed to load products</p>
          <p className="text-sm text-muted mb-4">There was an error connecting to the server. Please check your connection and try again.</p>
          <Button variant="outline" onClick={() => qc.invalidateQueries({ queryKey: ["products", tid] })}>
            Retry
          </Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-ink">Products</h1>
          <p className="text-muted text-sm mt-1">
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
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none" />
          <input
            type="text"
            placeholder="Search by name, description or category…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-stroke bg-panel text-ink placeholder:text-muted focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20"
          />
        </div>
      )}

      {/* Products list */}
      {products.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
              <div className="w-14 h-14 bg-primary-50 border border-primary-200 flex items-center justify-center mb-5">
                <Package className="w-7 h-7 text-primary-500" />
              </div>
              <h3 className="text-base font-semibold text-ink mb-1">No products yet</h3>
              <p className="text-sm text-muted max-w-xs mb-6">Start building your catalog by adding your first product</p>
              <Button onClick={() => openProductModal()}>Add your first product</Button>
            </div>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="w-8 h-8 text-muted mx-auto mb-3" />
            <p className="text-sm font-medium text-ink mb-1">No results found</p>
            <p className="text-sm text-muted">No products match &ldquo;{search}&rdquo;</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtered.map((p) => (
            <Card key={p.id}>
              {/* Product header */}
              <div
                className="flex items-center justify-between px-4 sm:px-6 py-4 cursor-pointer hover:bg-hover transition-colors"
                onClick={() => setExpanded((prev) => ({ ...prev, [p.id]: !prev[p.id] }))}
              >
                <div className="flex items-center gap-3 min-w-0">
                  {expanded[p.id]
                    ? <ChevronDown className="w-4 h-4 text-muted flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-muted flex-shrink-0" />}
                  <div className="w-8 h-8 bg-primary-50 border border-primary-200 flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <ProductThumbnail src={p.images?.[0]?.url} alt={p.name} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-ink">{p.name}</p>
                      {!p.isActive && <Badge variant="warning">Inactive</Badge>}
                      {p.type && p.type !== "physical" && (
                        <Badge variant={p.type === "digital" ? "info" : p.type === "service" ? "success" : "default"}>
                          {p.type}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {p.category && <Badge variant="info">{p.category.name}</Badge>}
                      {p.unit && <Badge variant="default">{p.unit.abbreviation}</Badge>}
                      <span className="text-xs text-muted">
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
                <div className="border-t border-stroke">
                  <div className="flex items-center justify-between px-4 sm:px-6 py-3">
                    <p className="text-sm font-medium text-ink">Variants</p>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => openImageModal(p)}>
                        <ImagePlus className="w-3.5 h-3.5 mr-1" /> Images
                        {(p.images?.length ?? 0) > 0 && <span className="ml-1 text-xs text-muted">({p.images?.length})</span>}
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openAttrModal(p)}>
                        <SlidersHorizontal className="w-3.5 h-3.5 mr-1" /> Attributes
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => openVariantModal(p.id)}>
                        <Plus className="w-3.5 h-3.5 mr-1" /> Add variant
                      </Button>
                    </div>
                  </div>

                  {p.variants.length === 0 ? (
                    <div className="px-4 sm:px-6 pb-5 text-center">
                      <p className="text-sm text-muted">No variants yet. Add one above.</p>
                    </div>
                  ) : (
                    <>
                      {/* Desktop variant table */}
                      <div className="hidden sm:block overflow-x-auto px-6 pb-4">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-left text-muted border-b border-stroke">
                              <th className="pb-2 text-xs font-semibold uppercase tracking-wider">Name</th>
                              <th className="pb-2 text-xs font-semibold uppercase tracking-wider">SKU</th>
                              <th className="pb-2 text-xs font-semibold uppercase tracking-wider">Price</th>
                              <th className="pb-2 text-xs font-semibold uppercase tracking-wider">Cost</th>
                              <th className="pb-2" />
                            </tr>
                          </thead>
                          <tbody>
                            {p.variants.map((v) => (
                              <tr key={v.id} className="border-b border-stroke last:border-0 hover:bg-hover transition-colors">
                                <td className="py-2.5 font-medium text-ink">{v.name}</td>
                                <td className="py-2.5">
                                  <span className="font-mono text-xs text-muted bg-stroke px-1.5 py-0.5">
                                    {v.sku}
                                  </span>
                                </td>
                                <td className="py-2.5 font-medium text-ink">{formatCurrency(v.price)}</td>
                                <td className="py-2.5 text-muted">{formatCurrency(v.costPrice)}</td>
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
                      <div className="sm:hidden divide-y divide-stroke pb-2">
                        {p.variants.map((v) => (
                          <div key={v.id} className="px-4 py-3 flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="font-medium text-ink text-sm">{v.name}</p>
                              <p className="font-mono text-xs text-muted mt-0.5">{v.sku}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-sm font-medium text-ink">{formatCurrency(v.price)}</span>
                                {v.costPrice && (
                                  <span className="text-xs text-muted">Cost: {formatCurrency(v.costPrice)}</span>
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
      <Modal
        open={productModal.open}
        onClose={closeProductModal}
        title={productModal.product ? "Edit product" : (productStep === 1 ? "Add product — Details" : "Add product — First variant")}
      >
        {productModal.product ? (
          /* Edit mode: single-step */
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
            <Select label="Unit of measurement" {...pForm.register("unitId")}>
              <option value="">No unit</option>
              {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
            </Select>
            <Select label="Product Type" {...pForm.register("type")}>
              <option value="physical">Physical</option>
              <option value="digital">Digital</option>
              <option value="service">Service</option>
              <option value="bundle">Bundle</option>
            </Select>

            {/* Images section */}
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Images</label>
              {(editImages.length > 0 || editNewPreviews.length > 0) && (
                <div className="grid grid-cols-4 gap-2 mb-2">
                  {editImages.map((img) => (
                    <div key={img.id} className="relative group border border-stroke bg-page">
                      <div className="aspect-square flex items-center justify-center overflow-hidden">
                        <ImageWithFallback src={img.url} alt={img.altText || "Product image"} className="w-full h-full object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEditExistingImage(img)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  {editNewPreviews.map((preview, idx) => (
                    <div key={`new-${idx}`} className="relative group border border-stroke bg-page">
                      <div className="aspect-square flex items-center justify-center overflow-hidden">
                        <img src={preview} alt="New upload" className="w-full h-full object-cover" />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeEditNewImage(idx)}
                        className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-muted cursor-pointer hover:text-ink transition-colors">
                <ImagePlus className="w-4 h-4" />
                <span>Add images</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => handleFormImageSelect(e, "edit")}
                />
              </label>
            </div>

            <div className="flex gap-3 justify-end pt-1">
              <Button type="button" variant="outline" onClick={closeProductModal}>Cancel</Button>
              <Button type="submit" loading={saveProduct.isPending}>Save</Button>
            </div>
          </form>
        ) : (
          /* Add mode: multi-step */
          <div className="flex flex-col gap-4">
            {/* Step indicator */}
            <div className="flex items-center gap-1">
              <div className={`w-6 h-6 flex items-center justify-center text-xs font-semibold ${productStep >= 1 ? "bg-primary-600 text-white" : "bg-stroke text-muted"}`}>1</div>
              <div className="flex-1 h-px bg-stroke" />
              <div className={`w-6 h-6 flex items-center justify-center text-xs font-semibold ${productStep >= 2 ? "bg-primary-600 text-white" : "bg-stroke text-muted"}`}>2</div>
            </div>

            {productStep === 1 && (
              <form onSubmit={goToProductStep2} className="flex flex-col gap-4">
                <Input
                  label="Name *"
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
                <Select label="Unit of measurement" {...pForm.register("unitId")}>
                  <option value="">No unit</option>
                  {units.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.abbreviation})</option>)}
                </Select>
                <Select label="Product Type" {...pForm.register("type")}>
                  <option value="physical">Physical</option>
                  <option value="digital">Digital</option>
                  <option value="service">Service</option>
                  <option value="bundle">Bundle</option>
                </Select>

                {/* Images section */}
                <div>
                  <label className="block text-sm font-medium text-ink mb-1.5">Images</label>
                  {formImagePreviews.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      {formImagePreviews.map((preview, idx) => (
                        <div key={idx} className="relative group border border-stroke bg-page">
                          <div className="aspect-square flex items-center justify-center overflow-hidden">
                            <img src={preview} alt={`Upload ${idx + 1}`} className="w-full h-full object-cover" />
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFormImage(idx)}
                            className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <label className="flex items-center gap-2 text-sm text-muted cursor-pointer hover:text-ink transition-colors">
                    <ImagePlus className="w-4 h-4" />
                    <span>Add images</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      multiple
                      className="hidden"
                      onChange={(e) => handleFormImageSelect(e, "add")}
                    />
                  </label>
                </div>

                <div className="flex gap-3 justify-end pt-1">
                  <Button type="button" variant="outline" onClick={closeProductModal}>Cancel</Button>
                  <Button type="submit">Next →</Button>
                </div>
              </form>
            )}

            {productStep === 2 && (
              <div className="flex flex-col gap-4">
                <p className="text-xs text-muted bg-primary-50 border border-primary-200 px-3 py-2">
                  Optionally add your first variant below. You can skip and add variants later.
                </p>
                <Input
                  label="Variant name"
                  placeholder="e.g. Default / Red / Large"
                  {...vForm.register("name")}
                  error={vForm.formState.errors.name?.message}
                />
                <Input
                  label="SKU"
                  placeholder="e.g. PROD-001"
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
                  <Button type="button" variant="outline" onClick={() => setProductStep(1)}>← Back</Button>
                  <Button type="button" onClick={handleAddProductSubmit} loading={isAddingProduct}>
                    Save product
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

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
          <Input
            label="Barcode (optional)"
            placeholder="e.g. 012345678901"
            {...vForm.register("barcode")}
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

      {/* Attributes modal */}
      <Modal open={attrModal.open} onClose={() => { setAttrModal({ open: false }); setAttrList([]); setNewAttrName(""); setNewOptionValues({}); }} title={`Attributes — ${attrModal.product?.name}`} size="lg">
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted">Define attributes (e.g. Color, Size) and their options. Variants will use these to specify attribute values.</p>
          {attrLoading ? (
            <div className="py-6 text-center text-sm text-muted">Loading…</div>
          ) : (
            <>
              {attrList.map((attr) => (
                <div key={attr.id} className="border border-stroke p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm text-ink">{attr.name}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        await api.delete(`/api/tenants/${tid}/products/${attrProductId}/attributes/${attr.id}`);
                        setAttrList((prev) => prev.filter((a) => a.id !== attr.id));
                      }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-red-400" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {attr.options.map((opt) => (
                      <span key={opt.id} className="inline-flex items-center gap-1 text-xs bg-stroke px-2 py-0.5 text-ink">
                        {opt.value}
                        <button
                          type="button"
                          className="text-muted hover:text-red-500"
                          onClick={async () => {
                            await api.delete(`/api/tenants/${tid}/products/${attrProductId}/attributes/${attr.id}/options/${opt.id}`);
                            setAttrList((prev) => prev.map((a) => a.id === attr.id ? { ...a, options: a.options.filter((o) => o.id !== opt.id) } : a));
                          }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                    <form
                      className="inline-flex items-center gap-1"
                      onSubmit={async (e) => {
                        e.preventDefault();
                        const val = (newOptionValues[attr.id] ?? "").trim();
                        if (!val) return;
                        const res = await api.post(`/api/tenants/${tid}/products/${attrProductId}/attributes/${attr.id}/options`, { value: val });
                        setAttrList((prev) => prev.map((a) => a.id === attr.id ? { ...a, options: [...a.options, res.data] } : a));
                        setNewOptionValues((prev) => ({ ...prev, [attr.id]: "" }));
                      }}
                    >
                      <input
                        type="text"
                        value={newOptionValues[attr.id] ?? ""}
                        onChange={(e) => setNewOptionValues((prev) => ({ ...prev, [attr.id]: e.target.value }))}
                        placeholder="Add option…"
                        className="text-xs border border-stroke px-2 py-0.5 bg-panel text-ink outline-none focus:border-primary-500 w-24"
                      />
                      <Button size="sm" variant="outline" type="submit"><Plus className="w-3 h-3" /></Button>
                    </form>
                  </div>
                </div>
              ))}
              {/* Add new attribute */}
              <form
                className="flex items-center gap-2"
                onSubmit={async (e) => {
                  e.preventDefault();
                  const name = newAttrName.trim();
                  if (!name) return;
                  const res = await api.post(`/api/tenants/${tid}/products/${attrProductId}/attributes`, { name });
                  setAttrList((prev) => [...prev, { ...res.data, options: res.data.options ?? [] }]);
                  setNewAttrName("");
                }}
              >
                <input
                  type="text"
                  value={newAttrName}
                  onChange={(e) => setNewAttrName(e.target.value)}
                  placeholder="New attribute name (e.g. Color)"
                  className="flex-1 text-sm border border-stroke px-3 py-1.5 bg-panel text-ink outline-none focus:border-primary-500"
                />
                <Button type="submit" size="sm"><Plus className="w-3.5 h-3.5" /> Add attribute</Button>
              </form>
            </>
          )}
          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => { setAttrModal({ open: false }); setAttrList([]); setNewAttrName(""); setNewOptionValues({}); }}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* Images modal */}
      <Modal
        open={imageModal.open}
        onClose={() => { setImageModal({ open: false }); setImageList([]); }}
        title={`Images — ${imageModal.product?.name || ""}`}
        size="lg"
      >
        <div className="flex flex-col gap-4">
          <p className="text-xs text-muted">Upload product images via MinIO storage. Supported formats: JPEG, PNG, WebP, GIF. Max 10 MB per file.</p>

          {/* Upload button */}
          <label className={cn(
            "flex flex-col items-center justify-center border-2 border-dashed border-stroke px-4 py-6 cursor-pointer hover:border-primary-400 hover:bg-hover transition-colors",
            imageUploading && "opacity-50 pointer-events-none"
          )}>
            <ImagePlus className="w-8 h-8 text-muted mb-2" />
            <span className="text-sm text-muted">{imageUploading ? "Uploading…" : "Click to upload images"}</span>
            <span className="text-xs text-muted mt-1">Or drag and drop</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              multiple
              className="hidden"
              onChange={handleImageUpload}
              disabled={imageUploading}
            />
          </label>

          {/* Image grid */}
          {imageList.length > 0 ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
              {imageList.map((img) => (
                <div key={img.id} className="relative group border border-stroke bg-page">
                  <div className="aspect-square flex items-center justify-center overflow-hidden">
                    <ImageWithFallback
                      src={img.url}
                      alt={img.altText || "Product image"}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteImage(img)}
                    className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                  {img.altText && (
                    <p className="text-xs text-muted truncate px-1 py-0.5">{img.altText}</p>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-sm text-muted">
              <Image className="w-8 h-8 mx-auto mb-2 text-stroke" />
              No images uploaded yet
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button variant="outline" onClick={() => { setImageModal({ open: false }); setImageList([]); }}>Done</Button>
          </div>
        </div>
      </Modal>

      {/* Delete product confirmation */}
      <Modal open={!!pendingDeleteProduct} onClose={() => setPendingDeleteProduct(null)} title="Delete product" size="sm">
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">
                Delete &ldquo;{pendingDeleteProduct?.name}&rdquo;?
              </p>
              <p className="text-sm text-muted mt-1">
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
            <div className="w-9 h-9 bg-red-50 border border-red-200 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-5 h-5 text-red-500" />
            </div>
            <div>
              <p className="text-sm font-medium text-ink">
                Delete variant &ldquo;{pendingDeleteVariant?.variant.name}&rdquo;?
              </p>
              <p className="text-sm text-muted mt-1">
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
