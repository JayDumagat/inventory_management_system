import { Link } from "react-router-dom";
import { Package, ArrowLeft } from "lucide-react";

export default function TermsPage() {
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
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-8">Last updated: {new Date().getFullYear()}</p>

        <p className="text-gray-600 mb-6">
          These Terms of Service ("Terms") govern your access to and use of Inventra. By creating an
          account or using the platform, you agree to these Terms. If you are using Inventra on behalf
          of a business, you represent that you have authority to bind that entity to these Terms.
        </p>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">1. Eligibility</h2>
          <p className="text-gray-600">
            You must be at least 18 years old and capable of entering into a legally binding agreement
            to use Inventra. By using our services, you represent that you meet these requirements.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">2. Account Responsibilities</h2>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>You are responsible for maintaining the security of your account credentials.</li>
            <li>You must immediately notify us of any unauthorized access to your account.</li>
            <li>You may not share your login credentials with unauthorized persons.</li>
            <li>You are responsible for all activities that occur under your account.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">3. Acceptable Use</h2>
          <p className="text-gray-600 mb-2">You agree not to:</p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Use the platform for any illegal purpose or in violation of any applicable law</li>
            <li>Violate the rights of any third party, including intellectual property rights</li>
            <li>Upload malware, viruses, or other malicious code</li>
            <li>Attempt to gain unauthorized access to any part of the platform</li>
            <li>Use the platform to facilitate tax evasion or fraudulent transactions</li>
            <li>Transmit unsolicited commercial communications (spam)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">4. Philippine Regulatory Compliance</h2>
          <p className="text-gray-600 mb-2">
            As a business operating in the Philippines, you acknowledge responsibility for compliance with:
          </p>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li><strong>BIR (Bureau of Internal Revenue):</strong> Proper issuance of official receipts, VAT compliance, and timely tax filings under the NIRC and TRAIN Law (RA 10963)</li>
            <li><strong>SEC (Securities and Exchange Commission):</strong> Maintaining updated corporate registration and filings for corporations and partnerships</li>
            <li><strong>DTI (Department of Trade and Industry):</strong> Valid DTI registration for sole proprietorships and compliance with the Consumer Act (RA 7394)</li>
            <li><strong>NPC (National Privacy Commission):</strong> Compliance with the Data Privacy Act of 2012 (RA 10173) for personal data you collect and process</li>
            <li><strong>Local Government Units:</strong> Valid Mayor's Permit / Business Permit</li>
          </ul>
          <p className="text-gray-600 mt-2">
            Inventra provides tools to help record compliance information, but is not responsible for
            ensuring your business's legal compliance. Consult a qualified accountant, lawyer, or
            compliance officer for advice specific to your situation.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">5. Data and Privacy</h2>
          <p className="text-gray-600">
            Your use of Inventra is also governed by our{" "}
            <Link to="/privacy-policy" className="text-blue-600 hover:underline">Privacy Policy</Link>.
            You are responsible for collecting customer personal data lawfully, obtaining consent where
            required, and fulfilling data subject rights under the Data Privacy Act of 2012 (RA 10173)
            and GDPR (where applicable) for data you collect through the platform.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">6. Subscription and Billing</h2>
          <ul className="list-disc pl-5 text-gray-600 space-y-1">
            <li>Free plan features are available at no cost with usage limits as described on our pricing page.</li>
            <li>Paid subscriptions are billed in advance on a monthly or annual basis.</li>
            <li>Prices are subject to applicable taxes including VAT where required.</li>
            <li>Cancellations take effect at the end of the current billing period.</li>
            <li>We reserve the right to modify pricing with 30 days' notice.</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">7. Intellectual Property</h2>
          <p className="text-gray-600">
            The Inventra platform, including all software, designs, and documentation, is the intellectual
            property of Inventra. You retain ownership of the data you input into the platform.
            You grant us a limited license to process your data solely to provide the services.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">8. Service Availability and SLA</h2>
          <p className="text-gray-600">
            We strive for high availability but do not guarantee uninterrupted service. Enterprise plan
            customers may have a separate Service Level Agreement (SLA). Planned maintenance will be
            announced in advance where possible.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">9. Limitation of Liability</h2>
          <p className="text-gray-600">
            To the maximum extent permitted by applicable law, Inventra shall not be liable for any
            indirect, incidental, special, or consequential damages arising from your use of the
            platform, including but not limited to loss of profits, data, or business opportunities.
            Our total liability for any claim shall not exceed the fees paid by you in the 12 months
            preceding the claim.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">10. Termination</h2>
          <p className="text-gray-600">
            Either party may terminate this agreement at any time. We reserve the right to suspend or
            terminate accounts that violate these Terms, with or without notice. Upon termination,
            your right to access the platform ceases, and we will retain your data for 30 days
            to allow for export before permanent deletion, except where law requires longer retention.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">11. Governing Law and Dispute Resolution</h2>
          <p className="text-gray-600">
            These Terms shall be governed by the laws of the Republic of the Philippines.
            Any disputes shall first be subject to good-faith negotiation. If unresolved,
            disputes shall be submitted to the jurisdiction of the appropriate courts of the Philippines,
            or to arbitration as agreed by the parties.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">12. Changes to Terms</h2>
          <p className="text-gray-600">
            We may update these Terms from time to time. We will notify you of material changes via
            email or in-app notification at least 15 days before they take effect. Continued use of
            the platform after the effective date constitutes acceptance of the updated Terms.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold text-gray-800 mb-3">13. Contact</h2>
          <p className="text-gray-600">
            For questions about these Terms, contact us at{" "}
            <a href="mailto:legal@inventra.app" className="text-blue-600 hover:underline">legal@inventra.app</a>.
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
