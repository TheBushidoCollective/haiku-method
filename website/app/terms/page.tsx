import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Terms of Service",
	description: "Terms of service for HAIKU Method and related services.",
}

export default function TermsPage() {
	return (
		<div className="mx-auto max-w-3xl px-4 py-16">
			<h1 className="mb-8 text-4xl font-bold">Terms of Service</h1>
			<p className="mb-6 text-sm text-stone-500">
				Effective date: March 10, 2026
			</p>

			<div className="space-y-8 text-stone-700 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-stone-900 [&_p]:leading-relaxed [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-1 [&_ol]:ml-6 [&_ol]:list-decimal [&_ol]:space-y-1">
				<section>
					<h2>Acceptance of Terms</h2>
					<p>
						By accessing or using haikumethod.ai and related services including
						the HAIKU MCP server (&quot;Services&quot;) operated by The Bushido
						Collective (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;), you
						agree to be bound by these Terms of Service. If you do not agree, do
						not use the Services.
					</p>
				</section>

				<section>
					<h2>Description of Services</h2>
					<p>
						HAIKU (Human AI Knowledge Unification) provides a framework and
						tooling for structured human-AI collaboration. The Services include:
					</p>
					<ul>
						<li>The HAIKU Method website and documentation</li>
						<li>The HAIKU MCP server for AI workspace management</li>
						<li>Google Drive integration for workspace storage</li>
						<li>Organization and team management features</li>
					</ul>
				</section>

				<section>
					<h2>Accounts</h2>
					<p>
						To use certain features, you must sign in with a Google account. You
						are responsible for maintaining the security of your account
						credentials. You agree to provide accurate information and to notify
						us of any unauthorized access.
					</p>
				</section>

				<section>
					<h2>Acceptable Use</h2>
					<p>You agree not to:</p>
					<ul>
						<li>
							Use the Services for any unlawful purpose or in violation of any
							applicable laws
						</li>
						<li>
							Attempt to gain unauthorized access to any part of the Services
						</li>
						<li>
							Interfere with or disrupt the Services or servers connected to the
							Services
						</li>
						<li>
							Use the Services to transmit malware, spam, or other harmful
							content
						</li>
						<li>
							Reverse engineer, decompile, or disassemble any part of the
							Services (except as permitted by applicable law)
						</li>
					</ul>
				</section>

				<section>
					<h2>Your Data</h2>
					<p>
						You retain ownership of all content and data you create or store
						through the Services, including workspace files stored in your Google
						Drive. We do not claim ownership of your content.
					</p>
					<p>
						You grant us a limited license to access and process your data solely
						to provide the Services. This license terminates when you delete your
						account or revoke access.
					</p>
				</section>

				<section>
					<h2>Open Source</h2>
					<p>
						The HAIKU Method framework, documentation, and Claude Code plugin are
						open source under the MIT License. These Terms govern your use of the
						hosted Services, not the open source software itself.
					</p>
				</section>

				<section>
					<h2>Availability and Changes</h2>
					<p>
						We strive to maintain the Services but do not guarantee uninterrupted
						availability. We may modify, suspend, or discontinue any part of the
						Services at any time. We will make reasonable efforts to notify you of
						significant changes.
					</p>
				</section>

				<section>
					<h2>Limitation of Liability</h2>
					<p>
						To the maximum extent permitted by law, the Services are provided
						&quot;as is&quot; without warranties of any kind, express or implied.
						We are not liable for any indirect, incidental, special, or
						consequential damages arising from your use of the Services.
					</p>
				</section>

				<section>
					<h2>Indemnification</h2>
					<p>
						You agree to indemnify and hold us harmless from any claims,
						liabilities, damages, or expenses arising from your use of the
						Services or violation of these Terms.
					</p>
				</section>

				<section>
					<h2>Termination</h2>
					<p>
						We may suspend or terminate your access to the Services at any time
						for violation of these Terms or for any other reason with reasonable
						notice. Upon termination, your right to use the Services ceases, but
						your data in Google Drive remains yours.
					</p>
				</section>

				<section>
					<h2>Changes to These Terms</h2>
					<p>
						We may update these Terms from time to time. Continued use of the
						Services after changes constitutes acceptance of the updated Terms. We
						will post the updated Terms on this page with a revised effective
						date.
					</p>
				</section>

				<section>
					<h2>Governing Law</h2>
					<p>
						These Terms are governed by the laws of the State of California,
						United States, without regard to conflict of law provisions.
					</p>
				</section>

				<section>
					<h2>Contact</h2>
					<p>
						For questions about these Terms, contact us at{" "}
						<a
							href="mailto:legal@thebushidocollective.com"
							className="text-teal-600 hover:text-teal-700"
						>
							legal@thebushidocollective.com
						</a>
						.
					</p>
				</section>
			</div>
		</div>
	)
}
