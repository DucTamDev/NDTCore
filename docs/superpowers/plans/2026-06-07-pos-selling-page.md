# POS Selling Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the OrderStaff POS selling page — a fullscreen split-panel view where staff browse a product catalog, pick options via modal, build an order, and submit it.

**Architecture:** New `src/modules/pos/` module with its own DTOs, API, service, Pinia stores, and components. A new `PosLayout.vue` (no admin nav chrome) hosts `/pos/:storeId`. Three Pinia stores handle shift/store state (`posShiftStore`), product catalog (`posCatalogStore`), and the in-progress cart (`posCartStore`). The view is a 65/35 split: Menu Panel (search + categories + product grid) on the left, Order Panel (items + submit) on the right.

**Tech Stack:** Vue 3 Composition API · TypeScript · Vuetify 3 · Tailwind CSS v4 · Pinia · Axios via `BaseClient`

**Backend assumption:** The following REST endpoints are assumed to exist (coordinate with backend team):
- `GET /pos/store/{storeId}/status` → `PosStoreStatusDto`
- `GET /pos/store/{storeId}/catalog` → `PosProductDto[]`
- `POST /pos/orders` → `CreatePosOrderResponse`
- `GET /pos/store/{storeId}/orders?ShiftId={id}` → `PosOrderHistoryItemDto[]`

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `src/modules/pos/models/dtos/pos-catalog.dto.ts` | Create | Backend contract for POS catalog |
| `src/modules/pos/models/dtos/pos-order.dto.ts` | Create | Create order request/response + history |
| `src/modules/pos/models/dtos/pos-shift.dto.ts` | Create | Store status + shift state |
| `src/modules/pos/models/types/pos-cart.types.ts` | Create | Frontend-only cart item types |
| `src/core/constants/api.constants.ts` | Modify | Add POS endpoint constants |
| `src/modules/pos/api/pos.api.ts` | Create | HTTP calls |
| `src/modules/pos/services/pos.service.ts` | Create | Business logic wrapper |
| `src/modules/pos/stores/pos-shift.store.ts` | Create | Store info + shift status |
| `src/modules/pos/stores/pos-catalog.store.ts` | Create | Products, categories, search/filter |
| `src/modules/pos/stores/pos-cart.store.ts` | Create | Cart items, totals, customer data |
| `src/layouts/PosLayout.vue` | Create | Fullscreen layout (no nav drawer) |
| `src/core/constants/app-routes.constants.ts` | Modify | Add POS route constants |
| `src/router/routes.ts` | Modify | Register `/pos/:storeId` route |
| `src/modules/pos/views/PosView.vue` | Create | Root two-column view |
| `src/modules/pos/components/PosHeader.vue` | Create | Header bar |
| `src/modules/pos/components/PosCategoryBar.vue` | Create | Horizontal scrollable category tabs |
| `src/modules/pos/components/PosProductCard.vue` | Create | Individual product card |
| `src/modules/pos/components/PosProductGrid.vue` | Create | Grid of product cards |
| `src/modules/pos/components/PosMenuPanel.vue` | Create | Left panel (search + categories + grid) |
| `src/modules/pos/components/PosOptionPicker.vue` | Create | Option picker modal |
| `src/modules/pos/components/PosOrderItem.vue` | Create | Single order line item |
| `src/modules/pos/components/PosOrderPanel.vue` | Create | Right panel (cart + submit) |
| `src/modules/pos/components/PosOrderHistoryDrawer.vue` | Create | Slide-in order history drawer |
| `.env.development` | Modify | Fix `VITE_ORDER_BASE_URL` to use `=` |

---

## Task 1: DTOs & Cart Types

**Files:**
- Create: `src/modules/pos/models/dtos/pos-catalog.dto.ts`
- Create: `src/modules/pos/models/dtos/pos-order.dto.ts`
- Create: `src/modules/pos/models/dtos/pos-shift.dto.ts`
- Create: `src/modules/pos/models/types/pos-cart.types.ts`

- [ ] **Step 1: Create POS catalog DTO**

```ts
// src/modules/pos/models/dtos/pos-catalog.dto.ts

export interface PosTagDto {
    Id: number
    Name: string
    ColorHex: string | null
    TextColor: string | null
}

export interface PosOptionDto {
    Id: number
    Name: string
    ResolvedPrice: number
    IsDefault: boolean
    IsAvailable: boolean
}

export interface PosOptionGroupDto {
    GroupId: number
    GroupName: string
    UiType: 'SingleSelect' | 'MultiSelect'
    IsRequired: boolean
    MinSelect: number
    MaxSelect: number
    DisplayOrder: number
    Options: PosOptionDto[]
}

export interface PosProductDto {
    Id: number
    CategoryId: number | null
    Name: string
    ShortDescription: string | null
    ResolvedPrice: number
    IsAvailable: boolean
    DisplayOrder: number
    ImageUrl: string | null
    Tags: PosTagDto[]
    OptionGroups: PosOptionGroupDto[]
}

export interface PosCategoryDto {
    Id: number
    ParentId: number | null
    Name: string
    ProductCount: number
    Children: PosCategoryDto[]
}

export interface PosCatalogDto {
    Categories: PosCategoryDto[]
    Products: PosProductDto[]
}
```

- [ ] **Step 2: Create POS shift/store DTO**

```ts
// src/modules/pos/models/dtos/pos-shift.dto.ts

export interface PosStoreStatusDto {
    StoreId: number
    StoreName: string
    LogoUrl: string | null
    IsAcceptingOrders: boolean
    HasOpenShift: boolean
    ShiftId: number | null
    ShiftOpenedAt: string | null
    ShiftOpenedBy: string | null
}
```

- [ ] **Step 3: Create POS order DTOs**

```ts
// src/modules/pos/models/dtos/pos-order.dto.ts

export interface CreatePosOrderItemRequest {
    ProductId: number
    Quantity: number
    Note: string | null
    SelectedOptionIds: number[]
}

export interface CreatePosOrderRequest {
    StoreId: number
    ShiftId: number
    CustomerName: string | null
    CustomerPhone: string | null
    Note: string | null
    Items: CreatePosOrderItemRequest[]
}

export interface CreatePosOrderResponse {
    OrderId: number
    OrderNumber: string
    Status: string
    CreatedAt: string
}

export interface PosOrderHistoryItemDto {
    Id: number
    OrderNumber: string
    Status: string
    TotalAmount: number
    ItemSummary: string
    CreatedAt: string
}
```

- [ ] **Step 4: Create frontend cart types**

```ts
// src/modules/pos/models/types/pos-cart.types.ts

export interface PosCartOption {
    optionId: number
    optionName: string
    groupId: number
    resolvedPrice: number
}

export interface PosCartItem {
    uid: string
    productId: number
    productName: string
    resolvedPrice: number
    quantity: number
    note: string
    selectedOptions: PosCartOption[]
}
```

- [ ] **Step 5: Type-check**

```bash
cd NDTCore.FE && npm run type-check
```

Expected: no new errors in pos module files.

---

## Task 2: API Layer

**Files:**
- Modify: `src/core/constants/api.constants.ts`
- Create: `src/modules/pos/api/pos.api.ts`

- [ ] **Step 1: Add POS endpoints to `api.constants.ts`**

In `src/core/constants/api.constants.ts`, replace the empty `ORDER` block:

```ts
ORDER: {
    ORDER_API: {},
},
```

with:

```ts
ORDER: {
    POS_API: {
        GET_STORE_STATUS:  (storeId: number) => `/pos/store/${storeId}/status`,
        GET_CATALOG:       (storeId: number) => `/pos/store/${storeId}/catalog`,
        CREATE_ORDER:      '/pos/orders',
        GET_ORDER_HISTORY: (storeId: number) => `/pos/store/${storeId}/orders`,
    },
},
```

- [ ] **Step 2: Create `pos.api.ts`**

```ts
// src/modules/pos/api/pos.api.ts
import { BaseClient } from '@/core/api/clients/base.client'
import { API_ENDPOINTS } from '@/core/constants/api.constants'
import type { ApiResponse } from '@/core/models/common.dto'
import type { PosCatalogDto, PosStoreStatusDto } from '../models/dtos/pos-catalog.dto'
import type { PosStoreStatusDto as PosStatusDto } from '../models/dtos/pos-shift.dto'
import type {
    CreatePosOrderRequest,
    CreatePosOrderResponse,
    PosOrderHistoryItemDto,
} from '../models/dtos/pos-order.dto'

const ENV_ORDER_URL = import.meta.env.VITE_ORDER_BASE_URL as string | undefined
if (!ENV_ORDER_URL) throw new Error('[PosApi] VITE_ORDER_BASE_URL is not defined')

class PosClient extends BaseClient {
    constructor() {
        super({ baseURL: ENV_ORDER_URL })
    }
}

const posClient = new PosClient()
const EP = API_ENDPOINTS.ORDER.POS_API

export const posApi = {
    getStoreStatusAsync(storeId: number): Promise<ApiResponse<PosStatusDto>> {
        return posClient.get(EP.GET_STORE_STATUS(storeId))
    },
    getCatalogAsync(storeId: number): Promise<ApiResponse<PosCatalogDto>> {
        return posClient.get(EP.GET_CATALOG(storeId))
    },
    createOrderAsync(payload: CreatePosOrderRequest): Promise<ApiResponse<CreatePosOrderResponse>> {
        return posClient.post(EP.CREATE_ORDER, payload)
    },
    getOrderHistoryAsync(
        storeId: number,
        shiftId: number,
    ): Promise<ApiResponse<PosOrderHistoryItemDto[]>> {
        return posClient.get(EP.GET_ORDER_HISTORY(storeId), { ShiftId: shiftId })
    },
}
```

> Note: `pos-catalog.dto.ts` exports `PosStoreStatusDto` — remove it from there. `PosStoreStatusDto` lives only in `pos-shift.dto.ts`. Fix the import in this file accordingly.

- [ ] **Step 3: Fix `.env.development` — `VITE_ORDER_BASE_URL` uses `:` not `=`**

Open `NDTCore.FE/.env.development`. Change:

```
VITE_ORDER_BASE_URL: https://localhost:44392/api
```

to:

```
VITE_ORDER_BASE_URL=https://localhost:44392/api
```

- [ ] **Step 4: Type-check**

```bash
npm run type-check
```

Expected: no new errors.

---

## Task 3: Service Layer

**Files:**
- Create: `src/modules/pos/services/pos.service.ts`

- [ ] **Step 1: Create `pos.service.ts`**

```ts
// src/modules/pos/services/pos.service.ts
import { posApi } from '../api/pos.api'
import type { PosCatalogDto } from '../models/dtos/pos-catalog.dto'
import type { PosStoreStatusDto } from '../models/dtos/pos-shift.dto'
import type {
    CreatePosOrderRequest,
    CreatePosOrderResponse,
    PosOrderHistoryItemDto,
} from '../models/dtos/pos-order.dto'

class PosService {
    async getStoreStatusAsync(storeId: number): Promise<PosStoreStatusDto | null> {
        const r = await posApi.getStoreStatusAsync(storeId)
        return r.Data ?? null
    }

    async getCatalogAsync(storeId: number): Promise<PosCatalogDto | null> {
        const r = await posApi.getCatalogAsync(storeId)
        return r.Data ?? null
    }

    async createOrderAsync(payload: CreatePosOrderRequest): Promise<CreatePosOrderResponse | null> {
        const r = await posApi.createOrderAsync(payload)
        return r.Data ?? null
    }

    async getOrderHistoryAsync(
        storeId: number,
        shiftId: number,
    ): Promise<PosOrderHistoryItemDto[]> {
        const r = await posApi.getOrderHistoryAsync(storeId, shiftId)
        return r.Data ?? []
    }
}

export const posService = new PosService()
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

---

## Task 4: Pinia Stores

**Files:**
- Create: `src/modules/pos/stores/pos-shift.store.ts`
- Create: `src/modules/pos/stores/pos-catalog.store.ts`
- Create: `src/modules/pos/stores/pos-cart.store.ts`

- [ ] **Step 1: Create `pos-shift.store.ts`**

```ts
// src/modules/pos/stores/pos-shift.store.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { posService } from '../services/pos.service'
import type { PosStoreStatusDto } from '../models/dtos/pos-shift.dto'

export const usePosShiftStore = defineStore('pos-shift', () => {
    const status   = ref<PosStoreStatusDto | null>(null)
    const isLoading = ref(false)

    const storeName         = computed(() => status.value?.StoreName ?? '')
    const logoUrl           = computed(() => status.value?.LogoUrl ?? null)
    const isAcceptingOrders = computed(() => status.value?.IsAcceptingOrders ?? false)
    const hasOpenShift      = computed(() => status.value?.HasOpenShift ?? false)
    const shiftId           = computed(() => status.value?.ShiftId ?? null)
    const shiftOpenedAt     = computed(() => status.value?.ShiftOpenedAt ?? null)
    const shiftOpenedBy     = computed(() => status.value?.ShiftOpenedBy ?? null)
    const canCreateOrder    = computed(() => isAcceptingOrders.value && hasOpenShift.value)

    async function fetchStatus(storeId: number): Promise<void> {
        isLoading.value = true
        try {
            status.value = await posService.getStoreStatusAsync(storeId)
        } finally {
            isLoading.value = false
        }
    }

    function $reset(): void {
        status.value    = null
        isLoading.value = false
    }

    return {
        status, isLoading,
        storeName, logoUrl, isAcceptingOrders, hasOpenShift,
        shiftId, shiftOpenedAt, shiftOpenedBy, canCreateOrder,
        fetchStatus, $reset,
    }
})
```

- [ ] **Step 2: Create `pos-catalog.store.ts`**

```ts
// src/modules/pos/stores/pos-catalog.store.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { posService } from '../services/pos.service'
import type { PosProductDto, PosCategoryDto } from '../models/dtos/pos-catalog.dto'

export const usePosCatalogStore = defineStore('pos-catalog', () => {
    const products           = ref<PosProductDto[]>([])
    const categories         = ref<PosCategoryDto[]>([])
    const isLoading          = ref(false)
    const keyword            = ref('')
    const selectedCategoryId = ref<number | null>(null)

    const filteredProducts = computed<PosProductDto[]>(() => {
        const kw = keyword.value.trim().toLowerCase()
        if (kw) {
            return products.value.filter((p) => p.Name.toLowerCase().includes(kw))
        }
        if (selectedCategoryId.value != null) {
            return products.value.filter((p) => p.CategoryId === selectedCategoryId.value)
        }
        return products.value
    })

    async function fetchCatalog(storeId: number): Promise<void> {
        isLoading.value = true
        try {
            const data = await posService.getCatalogAsync(storeId)
            products.value   = data?.Products ?? []
            categories.value = data?.Categories ?? []
        } finally {
            isLoading.value = false
        }
    }

    function selectCategory(categoryId: number | null): void {
        selectedCategoryId.value = categoryId
        keyword.value = ''
    }

    function $reset(): void {
        products.value           = []
        categories.value         = []
        isLoading.value          = false
        keyword.value            = ''
        selectedCategoryId.value = null
    }

    return {
        products, categories, isLoading, keyword, selectedCategoryId,
        filteredProducts,
        fetchCatalog, selectCategory, $reset,
    }
})
```

- [ ] **Step 3: Create `pos-cart.store.ts`**

```ts
// src/modules/pos/stores/pos-cart.store.ts
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { PosCartItem } from '../models/types/pos-cart.types'

export const usePosCartStore = defineStore('pos-cart', () => {
    const items         = ref<PosCartItem[]>([])
    const customerName  = ref('')
    const customerPhone = ref('')
    const orderNote     = ref('')

    const itemCount = computed(() => items.value.reduce((s, i) => s + i.quantity, 0))

    const totalAmount = computed(() =>
        items.value.reduce((sum, item) => {
            const optionTotal = item.selectedOptions.reduce((s, o) => s + o.resolvedPrice, 0)
            return sum + (item.resolvedPrice + optionTotal) * item.quantity
        }, 0),
    )

    function addItem(item: PosCartItem): void {
        items.value.push(item)
    }

    function updateItem(uid: string, updated: PosCartItem): void {
        const idx = items.value.findIndex((i) => i.uid === uid)
        if (idx !== -1) items.value[idx] = updated
    }

    function removeItem(uid: string): void {
        items.value = items.value.filter((i) => i.uid !== uid)
    }

    function updateQuantity(uid: string, quantity: number): void {
        const item = items.value.find((i) => i.uid === uid)
        if (item && quantity >= 1) item.quantity = quantity
    }

    function clearCart(): void {
        items.value         = []
        customerName.value  = ''
        customerPhone.value = ''
        orderNote.value     = ''
    }

    function $reset(): void {
        clearCart()
    }

    return {
        items, customerName, customerPhone, orderNote,
        itemCount, totalAmount,
        addItem, updateItem, removeItem, updateQuantity, clearCart, $reset,
    }
})
```

- [ ] **Step 4: Type-check**

```bash
npm run type-check
```

---

## Task 5: Layout + Routes

**Files:**
- Create: `src/layouts/PosLayout.vue`
- Modify: `src/core/constants/app-routes.constants.ts`
- Modify: `src/router/routes.ts`

- [ ] **Step 1: Create `PosLayout.vue`**

```vue
<!-- src/layouts/PosLayout.vue -->
<template>
  <ThemeProvider :type="THEME_PROVIDER_TYPE.Admin">
    <v-layout>
      <v-main>
        <RouterView />
      </v-main>
    </v-layout>
  </ThemeProvider>
</template>

<script setup lang="ts">
import ThemeProvider from '@/components/layout/ThemeProvider.vue'
import { THEME_PROVIDER_TYPE } from '@/plugins/vuetify/theme'
</script>
```

- [ ] **Step 2: Add POS routes to `app-routes.constants.ts`**

After the `PRODUCT` block, add:

```ts
POS: {
    POS: {
        NAME: 'pos',
        PATH: '/pos/:storeId',
    },
},
```

- [ ] **Step 3: Register route in `routes.ts`**

After the `ADMIN` block, before the `NOT_FOUND` block, add:

```ts
{
    path: APP_ROUTES.POS.POS.PATH,
    component: () => import('@/layouts/PosLayout.vue'),
    meta: { requiresAuth: true },
    children: [
        {
            path: '',
            name: APP_ROUTES.POS.POS.NAME,
            component: () => import('@/modules/pos/views/PosView.vue'),
            meta: { title: 'Bán hàng', requiresAuth: true },
        },
    ],
},
```

- [ ] **Step 4: Type-check**

```bash
npm run type-check
```

---

## Task 6: PosView (root shell)

**Files:**
- Create: `src/modules/pos/views/PosView.vue`

- [ ] **Step 1: Create `PosView.vue`**

```vue
<!-- src/modules/pos/views/PosView.vue -->
<template>
  <div class="pos-root d-flex flex-column" style="height: 100dvh; overflow: hidden;">
    <PosHeader :store-id="storeId" />

    <div class="pos-body d-flex flex-row flex-grow-1 overflow-hidden">
      <PosMenuPanel
        class="pos-menu-panel"
        style="flex: 65; min-width: 0; overflow: hidden;"
        @pick="openOptionPicker"
      />
      <v-divider vertical />
      <PosOrderPanel
        class="pos-order-panel"
        style="flex: 35; min-width: 320px; overflow: hidden;"
        @open-history="historyOpen = true"
      />
    </div>

    <PosOptionPicker
      v-model="optionPickerOpen"
      :product="pickedProduct"
      @add="onAddToCart"
    />

    <PosOrderHistoryDrawer v-model="historyOpen" :store-id="storeId" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { usePosShiftStore } from '../stores/pos-shift.store'
import { usePosCatalogStore } from '../stores/pos-catalog.store'
import { usePosCartStore } from '../stores/pos-cart.store'
import PosHeader from '../components/PosHeader.vue'
import PosMenuPanel from '../components/PosMenuPanel.vue'
import PosOrderPanel from '../components/PosOrderPanel.vue'
import PosOptionPicker from '../components/PosOptionPicker.vue'
import PosOrderHistoryDrawer from '../components/PosOrderHistoryDrawer.vue'
import type { PosProductDto } from '../models/dtos/pos-catalog.dto'
import type { PosCartItem } from '../models/types/pos-cart.types'

const route = useRoute()
const storeId = computed(() => Number(route.params.storeId))

const shiftStore   = usePosShiftStore()
const catalogStore = usePosCatalogStore()
const cartStore    = usePosCartStore()

const optionPickerOpen = ref(false)
const pickedProduct    = ref<PosProductDto | null>(null)
const historyOpen      = ref(false)

function openOptionPicker(product: PosProductDto): void {
    pickedProduct.value    = product
    optionPickerOpen.value = true
}

function onAddToCart(item: PosCartItem): void {
    cartStore.addItem(item)
    optionPickerOpen.value = false
}

onMounted(async () => {
    await Promise.all([
        shiftStore.fetchStatus(storeId.value),
        catalogStore.fetchCatalog(storeId.value),
    ])
})
</script>
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

---

## Task 7: PosHeader

**Files:**
- Create: `src/modules/pos/components/PosHeader.vue`

- [ ] **Step 1: Create `PosHeader.vue`**

```vue
<!-- src/modules/pos/components/PosHeader.vue -->
<template>
  <v-app-bar flat border="b" height="56" class="px-4">
    <!-- Store logo + name -->
    <div class="d-flex align-center ga-3">
      <v-avatar v-if="shiftStore.logoUrl" size="32" :image="shiftStore.logoUrl" />
      <v-icon v-else icon="mdi-store" size="24" />
      <span class="text-subtitle-1 font-weight-semibold">{{ shiftStore.storeName }}</span>

      <!-- Accepting orders badge -->
      <v-chip
        size="x-small"
        :color="shiftStore.isAcceptingOrders ? 'success' : 'error'"
        variant="tonal"
      >
        {{ shiftStore.isAcceptingOrders ? 'Đang nhận đơn' : 'Tạm dừng' }}
      </v-chip>
    </div>

    <v-spacer />

    <!-- Shift status -->
    <div class="d-flex align-center ga-2 mr-4 text-caption text-medium-emphasis">
      <template v-if="shiftStore.hasOpenShift">
        <v-icon icon="mdi-clock-outline" size="16" />
        <span>Ca {{ openedAtFormatted }} — {{ shiftStore.shiftOpenedBy }}</span>
      </template>
      <v-chip v-else size="x-small" color="warning" variant="tonal">
        Chưa mở ca
      </v-chip>
    </div>

    <!-- Order history icon -->
    <v-btn icon="mdi-history" variant="text" size="small" @click="$emit('openHistory')" />

    <!-- User menu -->
    <v-menu>
      <template #activator="{ props }">
        <v-btn v-bind="props" variant="text" size="small" append-icon="mdi-chevron-down">
          Tài khoản
        </v-btn>
      </template>
      <v-list density="compact">
        <v-list-item title="Đăng xuất" prepend-icon="mdi-logout" @click="logout" />
      </v-list>
    </v-menu>
  </v-app-bar>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/modules/auth/stores/auth.store'
import { usePosShiftStore } from '../stores/pos-shift.store'

defineProps<{ storeId: number }>()
defineEmits<{ openHistory: [] }>()

const shiftStore = usePosShiftStore()
const authStore  = useAuthStore()
const router     = useRouter()

const openedAtFormatted = computed(() => {
    if (!shiftStore.shiftOpenedAt) return ''
    return new Date(shiftStore.shiftOpenedAt).toLocaleTimeString('vi-VN', {
        hour: '2-digit',
        minute: '2-digit',
    })
})

function logout(): void {
    authStore.logout()
    router.push('/auth/login')
}
</script>
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

---

## Task 8: PosCategoryBar

**Files:**
- Create: `src/modules/pos/components/PosCategoryBar.vue`

- [ ] **Step 1: Create `PosCategoryBar.vue`**

```vue
<!-- src/modules/pos/components/PosCategoryBar.vue -->
<template>
  <div class="pos-category-bar overflow-x-auto" style="white-space: nowrap;">
    <v-chip-group
      v-model="selectedIndex"
      mandatory
      class="flex-nowrap px-2"
      selected-class="text-primary"
    >
      <v-chip
        v-for="cat in allCategories"
        :key="cat.id"
        :value="cat.id"
        variant="text"
        rounded="lg"
        @click="onSelect(cat.id)"
      >
        {{ cat.label }}
        <template v-if="cat.count != null">
          <v-badge :content="cat.count" inline class="ml-1" />
        </template>
      </v-chip>
    </v-chip-group>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { usePosCatalogStore } from '../stores/pos-catalog.store'

const catalogStore = usePosCatalogStore()

const selectedIndex = ref<number | null>(null)

const allCategories = computed(() => {
    const cats: { id: number | null; label: string; count: number | null }[] = [
        { id: null, label: 'Tất cả', count: null },
    ]
    for (const c of catalogStore.categories) {
        cats.push({ id: c.Id, label: c.Name, count: c.ProductCount })
    }
    return cats
})

function onSelect(id: number | null): void {
    catalogStore.selectCategory(id)
}

watch(
    () => catalogStore.selectedCategoryId,
    (val) => { selectedIndex.value = val },
)
</script>
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

---

## Task 9: PosProductCard + PosProductGrid

**Files:**
- Create: `src/modules/pos/components/PosProductCard.vue`
- Create: `src/modules/pos/components/PosProductGrid.vue`

- [ ] **Step 1: Create `PosProductCard.vue`**

```vue
<!-- src/modules/pos/components/PosProductCard.vue -->
<template>
  <v-card
    :disabled="!product.IsAvailable"
    :ripple="product.IsAvailable"
    variant="outlined"
    rounded="lg"
    class="pos-product-card d-flex flex-column"
    style="cursor: pointer; user-select: none;"
    @click="product.IsAvailable && $emit('pick', product)"
  >
    <!-- Image -->
    <v-img
      :src="product.ImageUrl ?? undefined"
      height="120"
      cover
      class="flex-shrink-0"
    >
      <template #placeholder>
        <div class="d-flex align-center justify-center h-100 bg-surface-variant">
          <v-icon icon="mdi-image-outline" size="40" color="medium-emphasis" />
        </div>
      </template>

      <!-- Out-of-stock overlay -->
      <template v-if="!product.IsAvailable">
        <div
          class="d-flex align-center justify-center h-100"
          style="background: rgba(0,0,0,.45);"
        >
          <v-chip size="small" color="error">Hết hàng</v-chip>
        </div>
      </template>

      <!-- Tag badges -->
      <div v-if="product.Tags.length" class="pos-tags pa-1 d-flex flex-wrap ga-1">
        <v-chip
          v-for="tag in product.Tags.slice(0, 2)"
          :key="tag.Id"
          size="x-small"
          :style="{
            backgroundColor: tag.ColorHex ?? undefined,
            color: tag.TextColor ?? undefined,
          }"
        >
          {{ tag.Name }}
        </v-chip>
      </div>
    </v-img>

    <!-- Info -->
    <v-card-text class="pa-2 pt-1">
      <div class="text-body-2 font-weight-medium text-truncate">{{ product.Name }}</div>
      <div class="text-body-2 text-primary font-weight-semibold mt-1">
        {{ product.ResolvedPrice.toLocaleString('vi-VN') }}₫
      </div>
    </v-card-text>
  </v-card>
</template>

<script setup lang="ts">
import type { PosProductDto } from '../models/dtos/pos-catalog.dto'

defineProps<{ product: PosProductDto }>()
defineEmits<{ pick: [product: PosProductDto] }>()
</script>
```

- [ ] **Step 2: Create `PosProductGrid.vue`**

```vue
<!-- src/modules/pos/components/PosProductGrid.vue -->
<template>
  <div class="overflow-y-auto flex-grow-1 pa-3">
    <!-- Loading skeleton -->
    <v-row v-if="catalogStore.isLoading" dense>
      <v-col v-for="n in 8" :key="n" cols="6" sm="4" md="3">
        <v-skeleton-loader type="card" height="180" />
      </v-col>
    </v-row>

    <!-- Empty state -->
    <div
      v-else-if="catalogStore.filteredProducts.length === 0"
      class="d-flex flex-column align-center justify-center ga-2 pa-8 text-medium-emphasis"
    >
      <v-icon icon="mdi-magnify-close" size="48" />
      <span>Không tìm thấy sản phẩm phù hợp</span>
    </div>

    <!-- Grid -->
    <v-row v-else dense>
      <v-col
        v-for="product in catalogStore.filteredProducts"
        :key="product.Id"
        cols="6"
        sm="4"
        md="3"
      >
        <PosProductCard :product="product" @pick="$emit('pick', product)" />
      </v-col>
    </v-row>
  </div>
</template>

<script setup lang="ts">
import { usePosCatalogStore } from '../stores/pos-catalog.store'
import PosProductCard from './PosProductCard.vue'
import type { PosProductDto } from '../models/dtos/pos-catalog.dto'

const catalogStore = usePosCatalogStore()
defineEmits<{ pick: [product: PosProductDto] }>()
</script>
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```

---

## Task 10: PosMenuPanel

**Files:**
- Create: `src/modules/pos/components/PosMenuPanel.vue`

- [ ] **Step 1: Create `PosMenuPanel.vue`**

```vue
<!-- src/modules/pos/components/PosMenuPanel.vue -->
<template>
  <div class="d-flex flex-column h-100">
    <!-- Search bar -->
    <div class="pa-3 pb-0">
      <v-text-field
        v-model="catalogStore.keyword"
        placeholder="Tìm theo tên hoặc SKU..."
        prepend-inner-icon="mdi-magnify"
        density="compact"
        variant="outlined"
        hide-details
        clearable
      />
    </div>

    <!-- Category bar — hidden when keyword is active -->
    <PosCategoryBar v-if="!catalogStore.keyword.trim()" class="pt-2" />

    <!-- Product grid -->
    <PosProductGrid @pick="$emit('pick', $event)" />
  </div>
</template>

<script setup lang="ts">
import { usePosCatalogStore } from '../stores/pos-catalog.store'
import PosCategoryBar from './PosCategoryBar.vue'
import PosProductGrid from './PosProductGrid.vue'
import type { PosProductDto } from '../models/dtos/pos-catalog.dto'

const catalogStore = usePosCatalogStore()
defineEmits<{ pick: [product: PosProductDto] }>()
</script>
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

---

## Task 11: PosOptionPicker

**Files:**
- Create: `src/modules/pos/components/PosOptionPicker.vue`

The option picker opens when a product is tapped. It shows each `PosOptionGroupDto` as a section with radio (SingleSelect) or checkbox (MultiSelect) behavior, validates required groups, and emits a `PosCartItem` on confirm.

- [ ] **Step 1: Create `PosOptionPicker.vue`**

```vue
<!-- src/modules/pos/components/PosOptionPicker.vue -->
<template>
  <v-dialog v-model="open" max-width="560" scrollable>
    <v-card v-if="product" rounded="lg">
      <!-- Header -->
      <v-img v-if="product.ImageUrl" :src="product.ImageUrl" height="180" cover />
      <v-card-title class="pt-3 pb-0">{{ product.Name }}</v-card-title>
      <v-card-subtitle v-if="product.ShortDescription" class="text-caption font-italic pb-2">
        {{ product.ShortDescription }}
      </v-card-subtitle>
      <v-card-subtitle class="text-primary font-weight-semibold">
        {{ product.ResolvedPrice.toLocaleString('vi-VN') }}₫ (giá cơ bản)
      </v-card-subtitle>

      <v-divider />

      <v-card-text class="pa-4">
        <div class="d-flex flex-column ga-6">
          <!-- Option groups -->
          <div v-for="group in product.OptionGroups" :key="group.GroupId">
            <!-- Group header -->
            <div class="d-flex align-center justify-space-between mb-2">
              <span class="text-subtitle-2 font-weight-semibold">{{ group.GroupName }}</span>
              <v-chip
                size="x-small"
                :color="group.IsRequired ? 'error' : 'default'"
                variant="tonal"
              >
                {{
                  group.IsRequired
                    ? group.MinSelect === group.MaxSelect
                      ? `Bắt buộc · Chọn ${group.MinSelect}`
                      : `Bắt buộc · Chọn ${group.MinSelect}–${group.MaxSelect}`
                    : `Tuỳ chọn · Tối đa ${group.MaxSelect}`
                }}
              </v-chip>
            </div>

            <!-- Error message -->
            <div
              v-if="groupErrors[group.GroupId]"
              class="text-error text-caption mb-1"
            >
              {{ groupErrors[group.GroupId] }}
            </div>

            <!-- Options: SingleSelect = radio, MultiSelect = checkbox -->
            <div class="d-flex flex-column ga-1">
              <v-sheet
                v-for="opt in group.Options"
                :key="opt.Id"
                class="d-flex align-center justify-space-between px-3 py-2 rounded cursor-pointer"
                :class="{ 'bg-primary-lighten-5': isSelected(group.GroupId, opt.Id) }"
                :style="{ opacity: opt.IsAvailable ? 1 : 0.4, cursor: opt.IsAvailable ? 'pointer' : 'not-allowed' }"
                @click="opt.IsAvailable && toggleOption(group, opt)"
              >
                <div class="d-flex align-center ga-3">
                  <v-icon
                    v-if="group.UiType === 'SingleSelect'"
                    :icon="isSelected(group.GroupId, opt.Id) ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank'"
                    :color="isSelected(group.GroupId, opt.Id) ? 'primary' : undefined"
                    size="20"
                  />
                  <v-icon
                    v-else
                    :icon="isSelected(group.GroupId, opt.Id) ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline'"
                    :color="isSelected(group.GroupId, opt.Id) ? 'primary' : undefined"
                    size="20"
                  />
                  <span
                    class="text-body-2"
                    :class="{ 'text-decoration-line-through': !opt.IsAvailable }"
                  >
                    {{ opt.Name }}
                  </span>
                </div>
                <span v-if="opt.ResolvedPrice > 0" class="text-body-2 text-medium-emphasis">
                  +{{ opt.ResolvedPrice.toLocaleString('vi-VN') }}₫
                </span>
              </v-sheet>
            </div>
          </div>

          <!-- Note -->
          <v-textarea
            v-model="note"
            label="Ghi chú cho món này"
            placeholder="VD: ít đá, không đường..."
            rows="2"
            density="compact"
            variant="outlined"
            hide-details
            auto-grow
          />

          <!-- Quantity -->
          <div class="d-flex align-center ga-4">
            <span class="text-subtitle-2">Số lượng</span>
            <div class="d-flex align-center ga-2">
              <v-btn
                icon="mdi-minus"
                variant="outlined"
                size="small"
                :disabled="quantity <= 1"
                @click="quantity--"
              />
              <span class="text-body-1 min-width-8 text-center">{{ quantity }}</span>
              <v-btn
                icon="mdi-plus"
                variant="outlined"
                size="small"
                @click="quantity++"
              />
            </div>
          </div>
        </div>
      </v-card-text>

      <v-divider />

      <!-- Footer: price preview + confirm -->
      <v-card-actions class="pa-4 d-flex align-center justify-space-between">
        <span class="text-subtitle-1 font-weight-semibold">
          {{ lineTotal.toLocaleString('vi-VN') }}₫
        </span>
        <v-btn color="primary" variant="flat" :disabled="!isValid" @click="confirm">
          Thêm vào đơn
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { PosProductDto, PosOptionGroupDto, PosOptionDto } from '../models/dtos/pos-catalog.dto'
import type { PosCartItem, PosCartOption } from '../models/types/pos-cart.types'

const props = defineProps<{
    modelValue: boolean
    product:    PosProductDto | null
}>()

const emit = defineEmits<{
    'update:modelValue': [value: boolean]
    add:                [item: PosCartItem]
}>()

const open     = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })
const quantity = ref(1)
const note     = ref('')

// Map groupId → Set of selected optionIds
const selections = ref<Map<number, Set<number>>>(new Map())
const groupErrors = ref<Record<number, string>>({})

// Reset state when product changes
watch(
    () => props.product,
    (product) => {
        quantity.value   = 1
        note.value       = ''
        groupErrors.value = {}
        const newMap     = new Map<number, Set<number>>()
        if (product) {
            for (const group of product.OptionGroups) {
                const defaultSet = new Set<number>()
                for (const opt of group.Options) {
                    if (opt.IsDefault && opt.IsAvailable) defaultSet.add(opt.Id)
                }
                newMap.set(group.GroupId, defaultSet)
            }
        }
        selections.value = newMap
    },
    { immediate: true },
)

function isSelected(groupId: number, optionId: number): boolean {
    return selections.value.get(groupId)?.has(optionId) ?? false
}

function toggleOption(group: PosOptionGroupDto, opt: PosOptionDto): void {
    const set = selections.value.get(group.GroupId) ?? new Set<number>()
    if (group.UiType === 'SingleSelect') {
        set.clear()
        set.add(opt.Id)
    } else {
        if (set.has(opt.Id)) {
            set.delete(opt.Id)
        } else if (set.size < group.MaxSelect) {
            set.add(opt.Id)
        }
    }
    selections.value = new Map(selections.value.set(group.GroupId, set))
}

const selectedOptions = computed<PosCartOption[]>(() => {
    if (!props.product) return []
    const result: PosCartOption[] = []
    for (const group of props.product.OptionGroups) {
        const set = selections.value.get(group.GroupId) ?? new Set()
        for (const opt of group.Options) {
            if (set.has(opt.Id)) {
                result.push({
                    optionId:      opt.Id,
                    optionName:    opt.Name,
                    groupId:       group.GroupId,
                    resolvedPrice: opt.ResolvedPrice,
                })
            }
        }
    }
    return result
})

const lineTotal = computed(() => {
    if (!props.product) return 0
    const optSum = selectedOptions.value.reduce((s, o) => s + o.resolvedPrice, 0)
    return (props.product.ResolvedPrice + optSum) * quantity.value
})

const isValid = computed(() => {
    if (!props.product) return false
    for (const group of props.product.OptionGroups) {
        if (!group.IsRequired) continue
        const count = selections.value.get(group.GroupId)?.size ?? 0
        if (count < group.MinSelect) return false
    }
    return true
})

function validate(): boolean {
    if (!props.product) return false
    const errors: Record<number, string> = {}
    for (const group of props.product.OptionGroups) {
        if (!group.IsRequired) continue
        const count = selections.value.get(group.GroupId)?.size ?? 0
        if (count < group.MinSelect) {
            errors[group.GroupId] = `Vui lòng chọn ít nhất ${group.MinSelect} lựa chọn`
        }
    }
    groupErrors.value = errors
    return Object.keys(errors).length === 0
}

function confirm(): void {
    if (!validate() || !props.product) return
    const item: PosCartItem = {
        uid:             crypto.randomUUID(),
        productId:       props.product.Id,
        productName:     props.product.Name,
        resolvedPrice:   props.product.ResolvedPrice,
        quantity:        quantity.value,
        note:            note.value,
        selectedOptions: selectedOptions.value,
    }
    emit('add', item)
}
</script>
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

---

## Task 12: PosOrderItem + PosOrderPanel

**Files:**
- Create: `src/modules/pos/components/PosOrderItem.vue`
- Create: `src/modules/pos/components/PosOrderPanel.vue`

- [ ] **Step 1: Create `PosOrderItem.vue`**

```vue
<!-- src/modules/pos/components/PosOrderItem.vue -->
<template>
  <div class="pos-order-item pa-2 rounded mb-1" style="border: 1px solid rgba(0,0,0,.08);">
    <div class="d-flex align-center justify-space-between">
      <span class="text-body-2 font-weight-semibold">{{ item.productName }}</span>
      <v-btn icon="mdi-close" size="x-small" variant="text" @click="$emit('remove', item.uid)" />
    </div>

    <div class="text-caption text-medium-emphasis mt-0-5">
      {{ optionSummary }}
    </div>
    <div v-if="item.note" class="text-caption font-italic text-medium-emphasis">
      Ghi chú: {{ item.note }}
    </div>

    <div class="d-flex align-center justify-space-between mt-1">
      <!-- Quantity spinner -->
      <div class="d-flex align-center ga-1">
        <v-btn
          icon="mdi-minus"
          size="x-small"
          variant="outlined"
          :disabled="item.quantity <= 1"
          @click="$emit('quantity', item.uid, item.quantity - 1)"
        />
        <span class="text-body-2 px-1">{{ item.quantity }}</span>
        <v-btn
          icon="mdi-plus"
          size="x-small"
          variant="outlined"
          @click="$emit('quantity', item.uid, item.quantity + 1)"
        />
      </div>

      <span class="text-body-2 font-weight-semibold">
        {{ lineTotal.toLocaleString('vi-VN') }}₫
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { PosCartItem } from '../models/types/pos-cart.types'

const props = defineProps<{ item: PosCartItem }>()
defineEmits<{
    remove:   [uid: string]
    quantity: [uid: string, qty: number]
}>()

const optionSummary = computed(() =>
    props.item.selectedOptions.map((o) => o.optionName).join(' · '),
)

const lineTotal = computed(() => {
    const optSum = props.item.selectedOptions.reduce((s, o) => s + o.resolvedPrice, 0)
    return (props.item.resolvedPrice + optSum) * props.item.quantity
})
</script>
```

- [ ] **Step 2: Create `PosOrderPanel.vue`**

```vue
<!-- src/modules/pos/components/PosOrderPanel.vue -->
<template>
  <div class="d-flex flex-column h-100">
    <!-- Header -->
    <div class="d-flex align-center justify-space-between pa-3 pb-0">
      <span class="text-subtitle-1 font-weight-semibold">Đơn mới</span>
      <div class="d-flex ga-1">
        <v-btn icon="mdi-history" size="small" variant="text" @click="$emit('openHistory')" />
        <v-btn
          icon="mdi-delete-outline"
          size="small"
          variant="text"
          color="error"
          :disabled="cartStore.items.length === 0"
          @click="confirmClear"
        />
      </div>
    </div>

    <!-- Customer info -->
    <div class="pa-3 pb-0 d-flex flex-column ga-2">
      <v-text-field
        v-model="cartStore.customerName"
        label="Tên khách (tuỳ chọn)"
        density="compact"
        variant="outlined"
        hide-details
      />
      <v-text-field
        v-model="cartStore.customerPhone"
        label="SĐT (tuỳ chọn)"
        density="compact"
        variant="outlined"
        hide-details
      />
      <v-textarea
        v-model="cartStore.orderNote"
        label="Ghi chú cho đơn..."
        density="compact"
        variant="outlined"
        hide-details
        rows="1"
        auto-grow
      />
    </div>

    <!-- Item list (scrollable) -->
    <div class="flex-grow-1 overflow-y-auto pa-3">
      <div v-if="cartStore.items.length === 0" class="text-center text-medium-emphasis pa-8">
        <v-icon icon="mdi-cart-outline" size="40" class="mb-2" />
        <div class="text-body-2">Chưa có sản phẩm trong đơn</div>
      </div>
      <PosOrderItem
        v-for="item in cartStore.items"
        :key="item.uid"
        :item="item"
        @remove="cartStore.removeItem($event)"
        @quantity="cartStore.updateQuantity($event, $event2)"
      />
    </div>

    <!-- Total + submit (sticky bottom) -->
    <v-divider />
    <div class="pa-3">
      <div class="d-flex justify-space-between text-body-2 mb-1">
        <span class="text-medium-emphasis">Tạm tính:</span>
        <span>{{ cartStore.totalAmount.toLocaleString('vi-VN') }}₫</span>
      </div>
      <div class="d-flex justify-space-between text-subtitle-2 font-weight-semibold mb-3">
        <span>Tổng cộng:</span>
        <span class="text-primary">{{ cartStore.totalAmount.toLocaleString('vi-VN') }}₫</span>
      </div>

      <!-- Block warnings -->
      <v-alert
        v-if="!shiftStore.isAcceptingOrders"
        type="warning"
        density="compact"
        class="mb-2"
        text="Cửa hàng đang tạm dừng nhận đơn."
      />
      <v-alert
        v-else-if="!shiftStore.hasOpenShift"
        type="warning"
        density="compact"
        class="mb-2"
        text="Vui lòng liên hệ Cashier/Manager để mở ca."
      />

      <v-btn
        color="primary"
        block
        :disabled="!canSubmit"
        :loading="isSubmitting"
        @click="submitOrder"
      >
        Gửi đơn
      </v-btn>
    </div>

    <!-- Success overlay -->
    <v-overlay
      v-model="successOpen"
      contained
      class="d-flex align-center justify-center"
    >
      <v-card class="pa-6 text-center" rounded="xl" max-width="280">
        <v-icon icon="mdi-check-circle" color="success" size="56" class="mb-3" />
        <div class="text-h6 mb-1">Đã gửi đơn thành công</div>
        <div class="text-subtitle-2 text-medium-emphasis mb-4">
          Mã đơn: <strong>{{ successOrderNumber }}</strong>
        </div>
        <div class="text-caption text-medium-emphasis mb-4">
          Chuyển cho Cashier để thanh toán.
        </div>
        <v-btn color="primary" variant="flat" @click="newOrder">Đơn mới</v-btn>
      </v-card>
    </v-overlay>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useToastNotification } from '@/composables/useToastNotification'
import { usePosCartStore } from '../stores/pos-cart.store'
import { usePosShiftStore } from '../stores/pos-shift.store'
import { posService } from '../services/pos.service'
import PosOrderItem from './PosOrderItem.vue'
import type { CreatePosOrderRequest } from '../models/dtos/pos-order.dto'

const props = defineProps<{ storeId: number }>()
defineEmits<{ openHistory: [] }>()

const cartStore  = usePosCartStore()
const shiftStore = usePosShiftStore()
const toast      = useToastNotification()

const isSubmitting      = ref(false)
const successOpen       = ref(false)
const successOrderNumber = ref('')

const canSubmit = computed(
    () =>
        cartStore.items.length > 0 &&
        shiftStore.isAcceptingOrders &&
        shiftStore.hasOpenShift &&
        !isSubmitting.value,
)

function confirmClear(): void {
    if (cartStore.items.length === 0) return
    cartStore.clearCart()
}

async function submitOrder(): Promise<void> {
    if (!canSubmit.value || !shiftStore.shiftId) return

    const payload: CreatePosOrderRequest = {
        StoreId:       props.storeId,
        ShiftId:       shiftStore.shiftId,
        CustomerName:  cartStore.customerName || null,
        CustomerPhone: cartStore.customerPhone || null,
        Note:          cartStore.orderNote || null,
        Items: cartStore.items.map((item) => ({
            ProductId:         item.productId,
            Quantity:          item.quantity,
            Note:              item.note || null,
            SelectedOptionIds: item.selectedOptions.map((o) => o.optionId),
        })),
    }

    isSubmitting.value = true
    try {
        const result = await posService.createOrderAsync(payload)
        if (result) {
            successOrderNumber.value = result.OrderNumber
            successOpen.value        = true
            cartStore.clearCart()
        }
    } catch {
        toast.error('Gửi đơn thất bại. Vui lòng thử lại.')
    } finally {
        isSubmitting.value = false
    }
}

function newOrder(): void {
    successOpen.value = false
}
</script>
```

> **Note on `@quantity` event**: Vue template event handler `@quantity="cartStore.updateQuantity($event, $event2)"` won't work for two-arg emits. Use an inline arrow function instead:

Replace in `PosOrderPanel.vue`:
```vue
@quantity="cartStore.updateQuantity($event, $event2)"
```
with:
```vue
@quantity="(uid, qty) => cartStore.updateQuantity(uid, qty)"
```

- [ ] **Step 3: Type-check**

```bash
npm run type-check
```

---

## Task 13: PosOrderHistoryDrawer

**Files:**
- Create: `src/modules/pos/components/PosOrderHistoryDrawer.vue`

- [ ] **Step 1: Create `PosOrderHistoryDrawer.vue`**

```vue
<!-- src/modules/pos/components/PosOrderHistoryDrawer.vue -->
<template>
  <v-navigation-drawer
    v-model="open"
    location="right"
    :width="360"
    temporary
  >
    <div class="d-flex flex-column h-100">
      <!-- Header -->
      <div class="d-flex align-center justify-space-between pa-3">
        <span class="text-subtitle-1 font-weight-semibold">Lịch sử đơn</span>
        <v-btn icon="mdi-close" size="small" variant="text" @click="open = false" />
      </div>

      <!-- Status filter -->
      <div class="px-3 pb-2">
        <v-chip-group v-model="filterStatus" mandatory>
          <v-chip value="all" size="small">Tất cả</v-chip>
          <v-chip value="Pending" size="small">Chờ xử lý</v-chip>
          <v-chip value="Completed" size="small">Hoàn thành</v-chip>
          <v-chip value="Cancelled" size="small">Đã huỷ</v-chip>
        </v-chip-group>
      </div>

      <v-divider />

      <!-- List -->
      <div class="overflow-y-auto flex-grow-1">
        <div v-if="isLoading" class="pa-4">
          <v-skeleton-loader v-for="n in 5" :key="n" type="list-item-two-line" />
        </div>

        <v-list v-else density="compact" lines="two">
          <v-list-item
            v-for="order in filteredHistory"
            :key="order.Id"
            :subtitle="`${order.ItemSummary} · ${order.TotalAmount.toLocaleString('vi-VN')}₫`"
          >
            <template #title>
              <div class="d-flex align-center ga-2">
                <span class="font-weight-semibold">#{{ order.OrderNumber }}</span>
                <v-chip size="x-small" :color="statusColor(order.Status)" variant="tonal">
                  {{ order.Status }}
                </v-chip>
                <span class="text-caption text-medium-emphasis ml-auto">
                  {{ formatTime(order.CreatedAt) }}
                </span>
              </div>
            </template>
          </v-list-item>

          <v-list-item v-if="filteredHistory.length === 0">
            <v-list-item-title class="text-medium-emphasis text-caption">
              Chưa có đơn nào trong ca này.
            </v-list-item-title>
          </v-list-item>
        </v-list>
      </div>
    </div>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { posService } from '../services/pos.service'
import { usePosShiftStore } from '../stores/pos-shift.store'
import type { PosOrderHistoryItemDto } from '../models/dtos/pos-order.dto'

const props = defineProps<{ modelValue: boolean; storeId: number }>()
const emit  = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const open = computed({ get: () => props.modelValue, set: (v) => emit('update:modelValue', v) })

const shiftStore    = usePosShiftStore()
const history       = ref<PosOrderHistoryItemDto[]>([])
const isLoading     = ref(false)
const filterStatus  = ref<string>('all')

const filteredHistory = computed(() => {
    if (filterStatus.value === 'all') return history.value
    return history.value.filter((o) => o.Status === filterStatus.value)
})

watch(open, async (val) => {
    if (!val || !shiftStore.shiftId) return
    isLoading.value = true
    try {
        history.value = await posService.getOrderHistoryAsync(
            props.storeId,
            shiftStore.shiftId,
        )
    } finally {
        isLoading.value = false
    }
})

function statusColor(status: string): string {
    const map: Record<string, string> = {
        Pending:   'warning',
        Completed: 'success',
        Cancelled: 'error',
    }
    return map[status] ?? 'default'
}

function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
}
</script>
```

- [ ] **Step 2: Type-check**

```bash
npm run type-check
```

---

## Task 14: Wire PosView events correctly + final type-check

In `PosView.vue`, wire `PosHeader` and `PosOrderPanel` together properly:

- [ ] **Step 1: Fix PosHeader event wiring in PosView**

`PosHeader` emits `openHistory`. In `PosView.vue`, change:

```vue
<PosHeader :store-id="storeId" />
```

to:

```vue
<PosHeader :store-id="storeId" @open-history="historyOpen = true" />
```

- [ ] **Step 2: Fix PosOrderPanel event wiring**

`PosOrderPanel` emits `openHistory` and needs `:store-id`. In `PosView.vue`:

```vue
<PosOrderPanel
  class="pos-order-panel"
  style="flex: 35; min-width: 320px; overflow: hidden;"
  :store-id="storeId"
  @open-history="historyOpen = true"
/>
```

- [ ] **Step 3: Run full type-check**

```bash
npm run type-check
```

Expected: No errors in any `src/modules/pos/**` file. Pre-existing errors in `product.client.ts`, `ui.store.ts`, `useTableSelection.ts` etc. are acceptable (pre-existing).

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Fix any reported issues.

---

## Self-Review Checklist

**Spec coverage:**

| Spec section | Task covering it |
|---|---|
| Header: logo, store name, accepting badge | Task 7 — PosHeader |
| Header: shift status read-only | Task 7 — PosHeader |
| Header: user dropdown + logout | Task 7 — PosHeader |
| Search bar + filter realtime | Task 10 — PosMenuPanel |
| Category bar + subcategory | Task 8 — PosCategoryBar |
| Product grid + card states (available/unavailable) | Task 9 — PosProductCard/Grid |
| Tag badges with ColorHex/TextColor | Task 9 — PosProductCard |
| Option picker modal | Task 11 — PosOptionPicker |
| Option group header + constraint label | Task 11 |
| SingleSelect/MultiSelect behavior | Task 11 |
| Option unavailable → dimmed + strikethrough | Task 11 |
| IsDefault pre-check | Task 11 |
| Item note (per-line) | Task 11 |
| Quantity spinner (min 1) | Task 11 |
| Price preview in picker | Task 11 |
| Validate required groups on confirm | Task 11 |
| Order panel — customer name/phone/note | Task 12 — PosOrderPanel |
| Order item list with summary | Task 12 — PosOrderItem |
| Inline quantity adjust on item | Task 12 — PosOrderItem |
| Delete item | Task 12 — PosOrderItem |
| Total realtime | Task 4 (cart store computed) |
| Submit button disabled conditions | Task 12 — PosOrderPanel |
| Submit confirm → POST → success state | Task 12 — PosOrderPanel |
| Success: order number + "Đơn mới" button | Task 12 — PosOrderPanel |
| Error states per error type | Partial — toast for generic, server error messages expected from API |
| Order history drawer | Task 13 |
| History filter by status | Task 13 |
| History read-only (no cancel/pay buttons) | Task 13 |

**Gap: Confirm dialog before submit**
The design says: "confirm dialog nhỏ: 'Xác nhận gửi đơn?'". Currently `submitOrder` goes directly. Add a `v-dialog` confirm step before calling `posService.createOrderAsync`. Implement inline in `PosOrderPanel.vue`:

```vue
<!-- After the v-btn "Gửi đơn", add: -->
<v-dialog v-model="confirmOpen" max-width="320">
  <v-card class="pa-4">
    <v-card-title>Xác nhận gửi đơn?</v-card-title>
    <v-card-text>Đơn sẽ không chỉnh sửa được sau khi gửi.</v-card-text>
    <v-card-actions class="justify-end ga-2">
      <v-btn variant="text" @click="confirmOpen = false">Huỷ</v-btn>
      <v-btn color="primary" variant="flat" :loading="isSubmitting" @click="doSubmit">Gửi</v-btn>
    </v-card-actions>
  </v-card>
</v-dialog>
```

And in script:

```ts
const confirmOpen = ref(false)

function submitOrder(): void {
    if (!canSubmit.value) return
    confirmOpen.value = true
}

async function doSubmit(): Promise<void> {
    confirmOpen.value = false
    // ... existing submit logic renamed from submitOrder
}
```

**Gap: Clear cart confirm**
Add `v-dialog` confirm before `cartStore.clearCart()` in `confirmClear` if items exist.

**Placeholder scan:** No TBD or vague steps found.

**Type consistency:** `PosCartItem.uid`, `PosCartOption.resolvedPrice` used consistently. `PosStoreStatusDto` is in `pos-shift.dto.ts` and imported from there. `PosCatalogDto.Products` / `.Categories` arrays match store usage.
