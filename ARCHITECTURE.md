# وثيقة المعمارية التقنية والتصميمية (Phase 1 Technical Architecture)
## نظام إدارة مجموعة الشركات والمهام والتقارير والصلاحيات المتقدمة

---

### الفهرس / Table of Contents
1. [نظرة عامة على النظام وأهداف المرحلة الأولى (Overview & Phase 1 Scope)](#1-overview)
2. [اختيار الـ Tech Stack وأسباب الاعتماد (Technology Stack & Justification)](#2-tech-stack)
3. [معمارية قاعدة البيانات والـ 17 كيانًا (Database Architecture & 17 Normalized Entities)](#3-database-architecture)
4. [معمارية الصلاحيات الدقيقة (Granular Permissions & RBAC Engine)](#4-permission-architecture)
5. [معمارية عزل الشركات المتعددة (Multi-Tenant Company Isolation Architecture)](#5-multi-company-architecture)
6. [هيكل المجلدات والملفات (Folder Structure)](#6-folder-structure)
7. [طريقة تشغيل المشروع والمتغيرات البيئية (Running the Project & Environment Variables)](#7-run-and-env)
8. [خارطة طريق المرحلة الثانية وطريقة إضافة الميزات (Phase 2 Roadmap & Adding Features)](#8-roadmap)

---

<a name="1-overview"></a>
### 1. نظرة عامة على النظام وأهداف المرحلة الأولى (Overview & Phase 1 Scope)

النظام مصمم خصيصًا لإدارة مجموعة شركات قابضة (Holding Group) تتراوح حاليًا بين 5 إلى 25 شركة تابعة أو شقيقة مع إمكانية التوسع غير المحدود.

#### ركائز المرحلة الأولى المنجزة (Phase 1 Deliverables):
- **معمارية أساسية قابلة للتوسع (Clean & Extensible Full-Stack Architecture)**: فصل صارم بين واجهة المستخدم، مسارات الخادم (API Routes)، قواعد البيانات، طبقة التوثيق (Authentication)، ومحرك الصلاحيات (Authorization).
- **تصميم قاعدة بيانات معيارية 3NF تشمل 17 كيانًا** مع علاقات المفاتيح الأجنبية وقيود التكامل (Integrity Constraints) وفهارس الأداء (Indexes).
- **محرك صلاحيات دقيق (Granular Capability-Based RBAC)** لا يعتمد فقط على مسميات الأدوار بل على مفاتيح صلاحيات محددة (`companies.view`, `tasks.edit`, `reports.export`, إلخ) قابلة للتخصيص الديناميكي من قبل Super Admin.
- **عزل أمني صارم للشركات (Backend Multi-Tenant Isolation)** عبر ترويسة `X-Company-Id` والتحقق الإلزامي في الـ Middleware قبل وصول أي طلب لقاعدة البيانات، مع تسجيل أي محاولة وصول غير مصرح بها في سجل التدقيق (Audit Log).
- **دعم ثنائي كامل للغتين العربية والإنجليزية (i18n)** مع التبديل الفوري للاتجاه (RTL / LTR) وخطوط مخصصة (Cairo للعربية، Plus Jakarta Sans للإنجليزية).

---

<a name="2-tech-stack"></a>
### 2. اختيار الـ Tech Stack وأسباب الاعتماد (Technology Stack & Justification)

| الطبقة (Layer) | التقنية المختارة | سبب الاختيار والمزايا الفنية |
| :--- | :--- | :--- |
| **Language** | **TypeScript 5.8** | أمان الأنماط (Type Safety) الشامل عبر الـ Frontend والـ Backend، مع تقليل أخطاء وقت التشغيل وتبادل الـ Interfaces المشتركة. |
| **Frontend Framework** | **React 19 + Vite 6** | أداء فائق في العرض التفاعلي، خفة الحجم، دعم كامل للـ Hooks والمكونات المعيارية والـ State Management النظيفة. |
| **Styling & Design** | **Tailwind CSS v4** | تصميم أنيق واحترافي مستجيب (Responsive)، توافق طبيعي مع اللغتين العربية والإنجليزية واتجاهات RTL/LTR، وخلو تام من "AI Slop". |
| **Backend Framework** | **Node.js + Express** | خادم RESTful API قوي وسريع وخفيف، يسمح بتطبيق الـ Middlewares الأمنية المخصصة لعزل الشركات وفحص الصلاحيات. |
| **Database Design & ORM** | **PostgreSQL DDL + Drizzle ORM** | تصميم علائقي نقي (Normalized 3NF) مع ملف `schema.sql` القياسي للإنتاج، ومخطط Drizzle ORM المُعرّف بنقاء، مدعومًا بمستودع بيانات علائقي فائق السرعة وخالٍ من مشاكل الترجمة C++. |
| **Security & Auth** | **JWT + bcryptjs** | تشفير كلمات المرور باستخدام Salt Rounds قوي، وتوليد رموز JWT موقعة بـ Secret Key، مع التحقق من صلاحية الحساب وحالته في كل طلب. |
| **i18n & Localization** | **Custom Context Engine** | خفيف، فوري وبدون تأخير، يحفظ تفضيل المستخدم في `localStorage` ويعدل خواص `document.dir` و `document.lang` بشكل تلقائي. |

---

<a name="3-database-architecture"></a>
### 3. معمارية قاعدة البيانات والـ 17 كيانًا (Database Architecture & 17 Normalized Entities)

تم تصميم قاعدة البيانات بصيغة معيارية 3NF تضمن عدم تكرار البيانات وسهولة التوسع والتحكم:

1. **`companies`**: جدول الشركات التابعة (الاسم بالعربية والإنجليزية، الرمز الفريد Code، العملة، الدولة، القطاع، إعدادات JSONB).
2. **`users`**: جدول المستخدمين (البريد، كلمة المرور المشفرة بـ bcrypt، الاسم بالعربية والإنجليزية، رقم الهاتف، الحالة).
3. **`roles`**: جدول الأدوار (Super Admin، Company Admin، Manager/Owner).
4. **`permissions`**: جدول الصلاحيات الدقيقة المعرفة بالنظام (المفتاح البرمجي، الوحدة، الاسم والوصف بالعربية والإنجليزية).
5. **`user_roles`**: جدول الربط N:M بين المستخدمين والأدوار مع إمكانية تحديد نطاق شركة معين.
6. **`role_permissions`**: جدول الربط N:M بين الأدوار ومفاتيح الصلاحيات الممنوحة.
7. **`user_companies`**: جدول الربط N:M بين المستخدمين والشركات لعزل الصلاحيات وحوكمة الوصول.
8. **`tasks`**: جدول المهام (الشركة، العنوان، الوصف، الحالة، الأولوية، المنشئ، المسند إليه، الموعد النهائي، الساعات المقدرة والمنفذة).
9. **`task_statuses`**: حالات مسار عمل المهام (قيد الانتظار، قيد التنفيذ، مراجعة، معلقة، مكتملة) مخصصة أو عامة.
10. **`task_priorities`**: مستويات الأولوية (منخفضة، متوسطة، عالية، حرجة وعاجلة).
11. **`task_updates`**: سجل تدقيق التعديلات الميدانية على المهام والحقول والقيم القديمة والجديدة.
12. **`task_notes`**: الملاحظات والتعليقات المتبادلة على المهام مع إمكانية تحديدها كـ Internal Only.
13. **`task_attachments`**: الملفات والمستندات المرفقة بالمهام والبيانات الوصفية لحجمها ونوعها.
14. **`custom_fields`**: الحقول المخصصة الديناميكية (EAV Pattern) المعرفة على مستوى كل شركة (نص، رقم، تاريخ، قائمة منسدلة، منطقي).
15. **`custom_field_values`**: قيم الحقول المخصصة المرتبطة بكل مهمة أو كيان.
16. **`notifications`**: الإشعارات الموجهة للمستخدمين داخل الشركات (إسناد مهام، تنبيهات أمنية، تغيير حالات).
17. **`audit_logs`**: سجل الرقابة والتدقيق الأمني غير القابل للتعديل الذي يوثق كافة العمليات الحساسة.

ملف الـ DDL القياسي متوفر بالكامل في: `src/server/db/schema.sql`
ملف الـ Drizzle ORM متوفر بالكامل في: `src/server/db/drizzle.schema.ts`

---

<a name="4-permission-architecture"></a>
### 4. معمارية الصلاحيات الدقيقة (Granular Permissions & RBAC Engine)

النظام لا يعتمد أبدًا على مقارنة نصوص الـ Roles داخل الشيفرة البرمجية (مثل `if (role === 'admin')`). بدلاً من ذلك، يعتمد على **Capability-Based Authorization**:

#### مفاتيح الصلاحيات المتوفرة (Permission Keys):
- **الشركات**: `companies.view`, `companies.create`, `companies.edit`, `companies.delete`
- **المهام**: `tasks.view`, `tasks.create`, `tasks.edit`, `tasks.delete`, `tasks.change_status`, `tasks.assign`
- **التقارير**: `reports.view`, `reports.export`
- **المستخدمين والصلاحيات**: `users.view`, `users.manage`, `permissions.manage`, `roles.manage`
- **النظام والحقول**: `custom_fields.manage`, `audit_logs.view`, `settings.manage`

#### آلية العمل في الخادم (Server-Side Middleware):
```typescript
// مثال لاستخدام الـ Middleware في حماية المسارات:
companyRouter.post('/', requirePermission(PermissionKey.COMPANIES_CREATE), handler);
roleRouter.put('/:roleId/permissions', requirePermission(PermissionKey.PERMISSIONS_MANAGE), handler);
```
إذا حاول المستخدم استدعاء endpoint دون امتلاك المفتاح المصرح، يرجع الخادم كود `403 Forbidden` ويسجل الحدث فورًا في `audit_logs`.

#### آلية العمل في الواجهة (Client-Side Guard):
```tsx
<PermissionGate perm={PermissionKey.COMPANIES_CREATE}>
  <button onClick={openAddModal}>إضافة شركة</button>
</PermissionGate>
```

---

<a name="5-multi-company-architecture"></a>
### 5. معمارية عزل الشركات المتعددة (Multi-Tenant Company Isolation Architecture)

1. **التحقق على مستوى الخادم (Backend Verification)**:
   - يرسل العميل ترويسة `X-Company-Id` مع كل استدعاء API.
   - يعترض الـ `requireCompanyAccess` middleware الطلب، ويتحقق مما إذا كان المستخدم يملك سجلًا نشطًا في جدول `user_companies` لهذه الشركة بالتحديد أو كان يملك دور `super_admin`.
   - في حال عدم المصادقة، يُرفض الطلب تلقائيًا برمز `403 Access Denied` ويتم حظر العملية وحفظ محاولة الاختراق في سجل التدقيق الأمني.
2. **محول الشركات النشط (Active Company Switcher)**:
   - يحمّل العميل فقط الشركات المصرح للمستخدم الوصول إليها.
   - للـ Super Admin، تظهر كافة الشركات مع إمكانية التبديل السريع وتفقد بيانات كل فرع.

---

<a name="6-folder-structure"></a>
### 6. هيكل المجلدات والملفات (Folder Structure)

```
├── .env.example                     # توثيق المتغيرات البيئية المطلوبة
├── ARCHITECTURE.md                  # الوثيقة التقنية الشاملة للنظام
├── index.html                       # نقطة البداية للمتصفح وتضمين الخطوط العربية والإنجليزية
├── metadata.json                    # وصف وإعدادات التطبيق
├── package.json                     # تعريف الحزم وأوامر التشغيل والبناء
├── server.ts                        # نقطة الدخول لخادم Express + Vite
├── tsconfig.json                    # إعدادات مترجم TypeScript
├── vite.config.ts                   # إعدادات حزمة Vite والـ Plugins
├── src/
│   ├── main.tsx                     # نقطة تشغيل React
│   ├── App.tsx                      # المكون الرئيسي وتوزيع علامات التبويب
│   ├── index.css                    # استيراد وتكوين Tailwind CSS
│   ├── types/                       # تعريف الأنواع والـ Interfaces
│   │   ├── auth.ts                  # أنواع المستخدم والتوثيق والـ Session
│   │   ├── company.ts               # أنواع إدارة وسياق الشركات
│   │   ├── database.ts              # الـ 17 كيانًا المعيارية
│   │   ├── permissions.ts           # مفاتيح وقواميس الصلاحيات الدقيقة
│   │   └── i18n.ts                  # أنواع اللغات والاتجاهات
│   ├── i18n/                        # محرك الترجمة
│   │   ├── translations.ts          # قواميس النصوص بالعربية والإنجليزية
│   │   └── I18nContext.tsx          # سياق اللغة وتحديث RTL / LTR
│   ├── context/                     # الـ React Contexts المركزية
│   │   ├── AuthContext.tsx          # إدارة جلسة المستخدم والأدوار والصلاحيات
│   │   └── CompanyContext.tsx       # إدارة الشركة النشطة وقائمة الشركات
│   ├── services/
│   │   └── api.ts                   # عميل الـ API المركزي الموحد
│   ├── components/                  # المكونات التفاعلية
│   │   ├── common/                  # المكونات المشتركة
│   │   │   ├── Header.tsx           # الشريط العلوي ومحول الشركات والمستخدمين
│   │   │   ├── Sidebar.tsx          # القائمة الجانبية للتنقل بين الوحدات
│   │   │   ├── PermissionGate.tsx   # حاجز التحقق من الصلاحيات
│   │   │   ├── Badge.tsx            # شارات الأدوار والحالات
│   │   │   └── Modal.tsx            # النوافذ المنبثقة التفاعلية
│   │   ├── auth/
│   │   │   └── LoginForm.tsx        # نموذج تسجيل الدخول مع الحسابات التجريبية
│   │   ├── dashboard/
│   │   │   └── OverviewDashboard.tsx# لوحة المؤشرات المركزية للمرحلة الأولى
│   │   ├── companies/
│   │   │   └── CompanyList.tsx      # استعراض وإضافة وتعديل الشركات
│   │   ├── permissions/
│   │   │   └── PermissionMatrix.tsx # مصفوفة الصلاحيات الدقيقة والتعديل الفوري
│   │   ├── users/
│   │   │   └── UserManagement.tsx   # دليل المستخدمين وتخصيص الشركات
│   │   ├── schema/
│   │   │   └── SchemaExplorer.tsx   # مستكشف قاعدة البيانات والـ DDL و Drizzle
│   │   └── audit/
│   │       └── AuditLogViewer.tsx   # مستعرض سجل التدقيق والأمان
└── src/server/                      # منطق الخادم وقاعدة البيانات
    ├── db/
    │   ├── schema.sql               # مخطط PostgreSQL DDL الكامل
    │   ├── drizzle.schema.ts        # تعريفات نماذج Drizzle ORM
    │   ├── seed.ts                  # بيانات البداية الواقعية والمشفرة بـ bcrypt
    │   └── storage.ts               # مستودع البيانات وإجراءات التدقيق
    ├── middleware/
    │   ├── auth.ts                  # التحقق من رمز JWT والمستخدم
    │   ├── tenant.ts                # التحقق من عزل الشركة عبر X-Company-Id
    │   └── permissions.ts           # التحقق من مفتاح الصلاحية المطلوب
    └── routes/
        ├── auth.routes.ts           # مسارات تسجيل الدخول والجلسة
        ├── company.routes.ts        # مسارات الشركات
        ├── role.routes.ts           # مسارات الأدوار والصلاحيات
        ├── user.routes.ts           # مسارات المستخدمين وتعيين الشركات
        ├── audit.routes.ts          # مسارات سجل التدقيق
        └── schema.routes.ts         # مسارات استعراض معمارية قاعدة البيانات
```

---

<a name="7-run-and-env"></a>
### 7. طريقة تشغيل المشروع والمتغيرات البيئية (Running the Project & Environment Variables)

#### المتغيرات البيئية (`.env`):
```env
# المنفذ الافتراضي
PORT=3000

# مفتاح توقيع رموز JWT المشفرة
JWT_SECRET="super-secret-jwt-key-change-in-production"

# رابط قاعدة البيانات عند النشر على PostgreSQL الإنتاجية (اختياري)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/multi_company_db"
```

#### أوامر التشغيل:
- **وضع التطوير (Development)**:
  ```bash
  npm run dev
  ```
  يقوم بتشغيل الخادم `server.ts` باستخدام `tsx` مع تكامل Vite Middleware على المنفذ `3000`.

- **بناء الإنتاج (Production Build)**:
  ```bash
  npm run build
  ```
  يبني الواجهة الأمامية عبر Vite ويجمع خادم Node.js عبر esbuild إلى `dist/server.cjs`.

- **تشغيل الإنتاج (Production Start)**:
  ```bash
  npm start
  ```

#### الحسابات التجريبية المتوفرة للاختبار:
1. **Super Admin**:
   - البريد: `superadmin@holding.com`
   - كلمة المرور: `SuperAdmin@2026`
   - النطاق: وصول شامل لكافة الشركات، وصلاحية تعديل الصلاحيات وتوليد الشركات الجديدة.
2. **Company Admin**:
   - البريد: `admin@holding.com`
   - كلمة المرور: `Admin@2026`
   - النطاق: شركة النور للتجزئة وشركة تك سفير للبرمجيات فقط.
3. **Manager / Owner**:
   - البريد: `manager@holding.com`
   - كلمة المرور: `Manager@2026`
   - النطاق: شركة النور للتجزئة فقط، بصلاحيات تشغيلية محدودة.

*(ملاحظة: يتوفر في الشريط العلوي أزرار للتبديل السريع بضغطة زر واحدة لتسهيل تقييم الأذونات).*

---

<a name="8-roadmap"></a>
### 8. خارطة طريق المرحلة الثانية وطريقة إضافة الميزات (Phase 2 Roadmap & Adding Features)

#### ما سيتم بناؤه في المرحلة الثانية (Phase 2 Roadmap):
1. **وحدة إدارة المهام المتقدمة (Task Management Module)**:
   - واجهة كانبان تفاعلية (Kanban Board) وقوائم تصفية متقدمة (List View).
   - مسار العمل (Workflow): تغيير الحالة (Status Transitions) مع فحص الصلاحية `tasks.change_status`.
   - التعليقات والملاحظات الداخلية (`task_notes`).
   - سجل التحديثات الزمني (`task_updates`).
   - رفع وإدارة المرفقات والمستندات (`task_attachments`).
   - محرك عرض الحقول المخصصة (`custom_fields` & `custom_field_values`) لكل شركة.
2. **وحدة التقارير ولوحات المؤشرات التحليلية (Reporting & Analytics Module)**:
   - مؤشرات الأداء ومعدلات إنجاز المهام حسب الشركة والقطاع.
   - تصدير التقارير بصيغ Excel و CSV و PDF مع فحص الصلاحية `reports.export`.

#### طريقة إضافة ميزات مستقبلية (How to Add Features):
1. أضف المفتاح الجديد في `src/types/permissions.ts` ضمن الـ Enum `PermissionKey` وقائمة `SYSTEM_PERMISSIONS`.
2. أنشئ الـ Entity أو الحقول في `src/server/db/schema.sql` و `drizzle.schema.ts`.
3. أنشئ الـ Route المحمي في `src/server/routes/` باستخدام `requireAuth`, `requireCompanyAccess`, و `requirePermission(...)`.
4. اربط الواجهة في `src/components/` مستخدمًا `<PermissionGate perm={...}>`.
