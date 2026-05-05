import { Link } from "react-router-dom";
import { Package, ArrowLeft } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-white text-gray-900">
      {/* Nav */}
      <nav className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b border-gray-100">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-blue-600 flex items-center justify-center">
              <Package className="w-5 h-5 text-white" />
            </div>
            <span className="text-lg font-bold text-gray-900">Inventra</span>
          </Link>
          <Link to="/" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors">
            <ArrowLeft className="w-4 h-4" /> Back to home
          </Link>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-6 py-12 prose prose-sm max-w-none">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: {new Date().getFullYear()}</p>

        <p className="text-gray-600 mb-6">
          Inventra ("we", "our", "us") is committed to protecting your personal information in compliance with
          the <strong>Data Privacy Act of 2012 (Republic Act No. 10173)</strong> of the Philippines and, where
          applicable, the <strong>EU General Data Protection Regulation (GDPR)</strong> and other international
          data-protection laws.
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Data Controller</h2>
          <p className="text-gray-600">
            Inventra acts as the Personal Information Controller (PIC) for data collected directly through
            our platform. Tenant businesses using Inventra are separate Personal Information Controllers
            for the data of their customers and staff, and are independently responsible for compliance
            with applicable data-privacy laws.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Personal Information We Collect</h2>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li><strong>Account data:</strong> name, email address, password (hashed), OAuth provider ID</li>
            <li><strong>Organization data:</strong> business name, TIN, SEC/DTI/Mayor's Permit numbers, business address</li>
            <li><strong>Customer data (collected by tenants):</strong> name, email, phone, address, purchase history, loyalty points</li>
            <li><strong>Usage data:</strong> IP address, browser/device information, access logs</li>
            <li><strong>Transaction data:</strong> sales orders, invoices, inventory adjustments</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Purpose and Legal Basis</h2>
          <p className="text-gray-600 mb-2">We process personal information for the following purposes:</p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Providing and improving the Inventra platform (contractual necessity)</li>
            <li>User authentication and account security</li>
            <li>Billing and subscription management</li>
            <li>Compliance with BIR, SEC, DTI, and other Philippine regulatory requirements</li>
            <li>Customer support and communications</li>
            <li>Security monitoring and fraud prevention</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Customer Data and Consent (NPC Compliance)</h2>
          <p className="text-gray-600 mb-2">
            Tenant businesses collecting personal data from their customers through Inventra must:
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Obtain explicit, informed consent before collecting personal information</li>
            <li>Inform data subjects of the purpose of collection and their rights under RA 10173</li>
            <li>Ensure collected data is accurate, relevant, and not excessive</li>
            <li>Retain personal data only for as long as necessary for the stated purpose</li>
            <li>Implement reasonable security measures to protect personal data</li>
          </ul>
          <p className="text-gray-600 mt-2">
            Inventra provides a data-consent checkbox in the customer management module to help tenants
            record and track customer consent in accordance with the Data Privacy Act.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Your Rights as a Data Subject</h2>
          <p className="text-gray-600 mb-2">Under RA 10173 and applicable laws, you have the right to:</p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li><strong>Access:</strong> obtain a copy of your personal data we hold</li>
            <li><strong>Rectification:</strong> correct inaccurate or incomplete data</li>
            <li><strong>Erasure / "Right to be forgotten":</strong> request deletion of your personal data</li>
            <li><strong>Object:</strong> object to processing of your personal data</li>
            <li><strong>Data portability:</strong> receive your data in a structured, machine-readable format</li>
            <li><strong>Withdraw consent:</strong> withdraw consent at any time without affecting prior lawful processing</li>
            <li><strong>Lodge a complaint:</strong> file a complaint with the National Privacy Commission (NPC) at <a href="https://www.privacy.gov.ph" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">privacy.gov.ph</a></li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Data Retention</h2>
          <p className="text-gray-600">
            We retain personal data for as long as your account is active or as needed to provide services.
            Transaction records and audit logs may be retained for up to <strong>10 years</strong> to comply
            with BIR requirements under the National Internal Revenue Code (NIRC) and Revenue Regulations.
            Upon account deletion, personal data is anonymized or permanently erased within 30 days,
            except where retention is required by law.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Data Security</h2>
          <p className="text-gray-600">
            We implement technical and organizational security measures including:
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1 mt-2">
            <li>Passwords hashed using Argon2id (NIST-recommended)</li>
            <li>HTTPS / TLS encryption for all data in transit</li>
            <li>Audit logging of all data access and modifications</li>
            <li>Role-based access control (RBAC) for tenant data</li>
            <li>Regular security assessments</li>
          </ul>
          <p className="text-gray-600 mt-2">
            In the event of a personal data breach, we will notify affected parties and the National Privacy
            Commission (NPC) within 72 hours of discovery, as required by RA 10173.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">8. International Data Transfers</h2>
          <p className="text-gray-600">
            Where personal data is transferred outside the Philippines or the European Economic Area,
            we ensure adequate safeguards are in place in accordance with NPC Circular No. 17-01
            and GDPR Chapter V requirements.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Cookies</h2>
          <p className="text-gray-600">
            We use only essential session cookies required for authentication. We do not use tracking,
            advertising, or analytics cookies without your consent.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Changes to This Policy</h2>
          <p className="text-gray-600">
            We may update this Privacy Policy to reflect changes in law or our practices.
            We will notify registered users of material changes via email or an in-app notification
            at least 15 days before the changes take effect.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">11. Contact Us / Data Protection Officer</h2>
          <p className="text-gray-600">
            To exercise your rights or for any privacy-related inquiries, please contact our Data
            Protection Officer (DPO) at <a href="mailto:privacy@inventra.app" className="text-blue-600 hover:underline">privacy@inventra.app</a>.
          </p>
          <p className="text-gray-600 mt-2">
            For complaints, you may also contact the <strong>National Privacy Commission (NPC)</strong>:
            <br />
            <a href="https://www.privacy.gov.ph" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">www.privacy.gov.ph</a>
          </p>
        </section>
      </main>

      <footer className="border-t border-gray-100 py-6 mt-8">
        <div className="max-w-4xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-gray-400">
          <span>© {new Date().getFullYear()} Inventra. All rights reserved.</span>
          <div className="flex gap-4">
            <Link to="/privacy-policy" className="hover:text-gray-600">Privacy Policy</Link>
            <Link to="/terms" className="hover:text-gray-600">Terms of Service</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
