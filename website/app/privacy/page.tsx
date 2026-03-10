import type { Metadata } from "next"

export const metadata: Metadata = {
	title: "Privacy Policy",
	description: "Privacy policy for HAIKU Method and related services.",
}

export default function PrivacyPage() {
	return (
		<div className="mx-auto max-w-3xl px-4 py-16">
			<h1 className="mb-8 text-4xl font-bold">Privacy Policy</h1>
			<p className="mb-6 text-sm text-stone-500">
				Effective date: March 10, 2026
			</p>

			<div className="space-y-8 text-stone-700 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-stone-900 [&_p]:leading-relaxed [&_ul]:ml-6 [&_ul]:list-disc [&_ul]:space-y-1">
				<section>
					<h2>Overview</h2>
					<p>
						The Bushido Collective (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates
						haikumethod.ai and related services including the HAIKU MCP server
						(&quot;Services&quot;). This policy describes how we collect, use, and protect
						your information.
					</p>
				</section>

				<section>
					<h2>Information We Collect</h2>
					<p>When you use our Services, we may collect:</p>
					<ul>
						<li>
							<strong>Account information:</strong> Name and email address from
							your Google account when you sign in via Google OAuth.
						</li>
						<li>
							<strong>Usage data:</strong> Basic analytics about how you interact
							with our Services (pages visited, features used).
						</li>
						<li>
							<strong>Google Drive data:</strong> When you connect Google Drive,
							we access only the specific files and folders created by our
							application within your Drive. We request the{" "}
							<code className="rounded bg-stone-100 px-1 py-0.5 text-sm">
								drive.file
							</code>{" "}
							scope, which limits access to files created or opened by our app.
						</li>
					</ul>
				</section>

				<section>
					<h2>How We Use Your Information</h2>
					<ul>
						<li>To provide and maintain the Services</li>
						<li>To authenticate your identity and manage your account</li>
						<li>
							To store and retrieve HAIKU workspace data in your Google Drive
						</li>
						<li>To communicate with you about the Services</li>
					</ul>
				</section>

				<section>
					<h2>Data Storage and Security</h2>
					<p>
						Your HAIKU workspace data is stored in your own Google Drive account.
						We do not store copies of your workspace files on our servers. Account
						information is stored in a secured PostgreSQL database. We use
						industry-standard encryption for data in transit (TLS) and at rest.
					</p>
				</section>

				<section>
					<h2>Third-Party Services</h2>
					<p>We use the following third-party services:</p>
					<ul>
						<li>
							<strong>Google OAuth:</strong> For authentication. Subject to{" "}
							<a
								href="https://policies.google.com/privacy"
								className="text-teal-600 hover:text-teal-700"
								target="_blank"
								rel="noopener noreferrer"
							>
								Google&apos;s Privacy Policy
							</a>
							.
						</li>
						<li>
							<strong>Google Drive API:</strong> For workspace storage. We only
							access files created by our application.
						</li>
						<li>
							<strong>Railway:</strong> For hosting. Subject to{" "}
							<a
								href="https://railway.com/legal/privacy"
								className="text-teal-600 hover:text-teal-700"
								target="_blank"
								rel="noopener noreferrer"
							>
								Railway&apos;s Privacy Policy
							</a>
							.
						</li>
					</ul>
				</section>

				<section>
					<h2>Data Retention</h2>
					<p>
						We retain your account information for as long as your account is
						active. You may request deletion of your account and associated data
						at any time by contacting us. Workspace data in your Google Drive
						remains under your control and can be deleted directly from your Drive.
					</p>
				</section>

				<section>
					<h2>Your Rights</h2>
					<p>You have the right to:</p>
					<ul>
						<li>Access the personal information we hold about you</li>
						<li>Request correction of inaccurate information</li>
						<li>Request deletion of your account and data</li>
						<li>
							Revoke Google Drive access at any time through your{" "}
							<a
								href="https://myaccount.google.com/permissions"
								className="text-teal-600 hover:text-teal-700"
								target="_blank"
								rel="noopener noreferrer"
							>
								Google Account settings
							</a>
						</li>
					</ul>
				</section>

				<section>
					<h2>Changes to This Policy</h2>
					<p>
						We may update this policy from time to time. We will notify you of
						significant changes by posting the new policy on this page and
						updating the effective date.
					</p>
				</section>

				<section>
					<h2>Contact</h2>
					<p>
						For questions about this privacy policy, contact us at{" "}
						<a
							href="mailto:privacy@thebushidocollective.com"
							className="text-teal-600 hover:text-teal-700"
						>
							privacy@thebushidocollective.com
						</a>
						.
					</p>
				</section>
			</div>
		</div>
	)
}
