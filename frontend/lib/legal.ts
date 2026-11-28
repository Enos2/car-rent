// Project: Via Nostra
// File: frontend/lib/legal.ts
// Purpose: The text of the legal pages: Terms and Conditions, Privacy Policy and
//          Rental Rules. DRAFTS: replace the [placeholders] and have a lawyer in
//          your country review everything before real customers use the site.

export type LegalSection = { heading: string; paragraphs: string[] };

export type LegalDoc = {
  title: string;
  updated: string;
  sections: LegalSection[];
};

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  terms: {
    title: 'Terms and Conditions',
    updated: '28 November 2026',
    sections: [
      {
        heading: '1. About Via Nostra',
        paragraphs: [
          'Via Nostra is operated by [Company legal name], [registered address] ("we", "us"). Via Nostra is a marketplace that connects people who want to rent a car ("renters") with people and companies who offer cars ("owners"). We are not the owner of the cars and we are not a party to the rental itself, except where these terms say we hold or move money.',
        ],
      },
      {
        heading: '2. Accounts and verification',
        paragraphs: [
          'You must be at least 18 and able to enter into a contract. Everything you tell us must be true and kept up to date. You are responsible for your account and for keeping your password safe.',
          'Before you can rent or list a car you must pass identity verification. We may ask for an identity document, a selfie, a driving licence and, for companies, business registration and tax papers. We may reject or withdraw verification at any time if we have a reason to doubt it. Our verification does not guarantee anyone\'s behaviour.',
        ],
      },
      {
        heading: '3. Owners',
        paragraphs: [
          'You may list only a car you own or are fully entitled to rent out. You must provide the logbook, registration and valid insurance that covers renting the car to others, and keep them valid while the car is on Via Nostra. Your listing must be accurate and the car must be safe, roadworthy and legally on the road.',
          'Every car is delivered to a Via Nostra hub, where staff inspect it and record its condition before it can go live. Cars are handed to renters and returned at the hub. We may refuse, pause or suspend any car at any time for safety, policy or legal reasons.',
        ],
      },
      {
        heading: '4. Renters',
        paragraphs: [
          'You must hold a valid driving licence for the car\'s category and show your identity document at the hub when you collect the car. Only the verified renter may drive the car unless we agree otherwise in writing. You must keep to the traffic laws, return the car on time, in the condition you received it, with the agreed fuel level, and pay all fines, tolls and parking charges incurred during the rental.',
        ],
      },
      {
        heading: '5. Payments, deposit and commission',
        paragraphs: [
          'You pay the rental price and a refundable deposit when you book. Via Nostra holds the money. The rental price is released to the owner, minus our commission, only after the renter confirms that they received the car. The deposit is held until the car is returned and inspected, and is then refunded to the renter, less any amount deducted for damage, which is paid to the owner.',
          'Our commission is shown to owners and may differ for individuals and companies. Owners can request a payout of their released earnings, which our finance team reviews before paying. We may delay or refuse a payout if we suspect fraud or a breach of these terms.',
        ],
      },
      {
        heading: '6. Cancellations and refunds',
        paragraphs: [
          'The cancellation rules are set out in the Rental Rules. If an owner or Via Nostra cancels a paid booking, the renter always receives a full refund of everything they paid.',
        ],
      },
      {
        heading: '7. Damage, accidents and theft',
        paragraphs: [
          'The renter must report any accident, damage, theft or breakdown to the hub and, where required, the police, without delay. Damage found at the return inspection may be deducted from the deposit, up to the deposit amount, with a written reason. Costs beyond the deposit and the owner\'s insurance are between the renter and the owner, and we may help to resolve them but we are not liable for them.',
        ],
      },
      {
        heading: '8. What is not allowed',
        paragraphs: [
          'You may not use Via Nostra to commit fraud or any crime; give false information or documents; take a car out of the agreed area or country without permission; sublet the car; use it for racing, towing, taxi or delivery services, or any use not allowed by its insurance; drive under the influence of alcohol or drugs; or harass or discriminate against anyone. You may not arrange payments outside Via Nostra to avoid our fees.',
        ],
      },
      {
        heading: '9. Reviews and reports',
        paragraphs: [
          'You can review a rental for 30 days after the car is returned. Reviews must be honest and respectful. You can report any car, person, review or post, and our team will look at it. We may remove content and may suspend accounts that break these terms.',
        ],
      },
      {
        heading: '10. Suspension and ending your account',
        paragraphs: [
          'We may suspend or close an account that breaks these terms or puts others at risk. You may stop using Via Nostra at any time once your bookings and any money owed are settled.',
        ],
      },
      {
        heading: '11. Our responsibility',
        paragraphs: [
          'We provide Via Nostra "as is". To the fullest extent the law allows, we are not responsible for the condition, safety or legality of any car, for what owners and renters do, or for losses that were not caused by our breach of these terms. Nothing in these terms limits any right you have under the law that cannot be limited.',
        ],
      },
      {
        heading: '12. Disputes and governing law',
        paragraphs: [
          'These terms are governed by the laws of [Country]. Please contact us first at [support email] so we can try to solve the problem. Any dispute we cannot solve will be decided by the courts of [Country / city], unless the law gives you the right to go elsewhere.',
        ],
      },
      {
        heading: '13. Changes',
        paragraphs: [
          'We may update these terms. When we make a change that matters, we will tell you and ask you to accept it. If you keep using Via Nostra after that, the new terms apply.',
        ],
      },
    ],
  },

  privacy: {
    title: 'Privacy Policy',
    updated: '28 November 2026',
    sections: [
      {
        heading: '1. Who we are',
        paragraphs: [
          '[Company legal name] runs Via Nostra and is responsible for your personal information. You can contact us about privacy at [privacy email].',
        ],
      },
      {
        heading: '2. What we collect',
        paragraphs: [
          'Account details (name, email, password in protected form, account type, company name). Verification documents (identity document, selfie, driving licence, business papers). Information about cars you list (details, documents, photos). Bookings, payments and payout details. Reviews and reports. Technical information such as your IP address and device, used for security.',
        ],
      },
      {
        heading: '3. Why we use it',
        paragraphs: [
          'To run the marketplace and your bookings; to verify identities and prevent fraud; to hold and send payments; to keep the platform safe; to answer support requests; and to meet legal duties.',
        ],
      },
      {
        heading: '4. Who can see it',
        paragraphs: [
          'Your verification documents are seen only by our verification team, and every time one is opened it is recorded. Owners see a renter\'s first name for their bookings; renters see an owner\'s display name. Our staff see only what their role needs. Payment providers process your payments for us. We do not sell your personal information.',
        ],
      },
      {
        heading: '5. How long we keep it',
        paragraphs: [
          'We keep your information while your account is open and for [retention period] afterwards, or longer where the law requires, for example for financial records.',
        ],
      },
      {
        heading: '6. Security',
        paragraphs: [
          'Passwords are stored in protected form, documents are kept in private storage, and access is limited and logged. No system is perfectly secure, so please use a strong password and tell us at once if you think your account was misused.',
        ],
      },
      {
        heading: '7. Your rights',
        paragraphs: [
          'Depending on where you live, you may have the right to see, correct or delete your information, to object to some uses, and to complain to your data protection authority. Contact us at [privacy email]. We may need to keep some information to meet legal duties.',
        ],
      },
      {
        heading: '8. Children',
        paragraphs: ['Via Nostra is only for people aged 18 and over.'],
      },
    ],
  },

  rules: {
    title: 'Rental Rules and Cancellation Policy',
    updated: '28 November 2026',
    sections: [
      {
        heading: 'How a rental works',
        paragraphs: [
          '1. The renter books a car and pays. The car is held for 30 minutes while payment is made. 2. The renter collects the car at the hub on the start date, showing their identity document. Hub staff record the car\'s condition. 3. In the app, the renter confirms they received the car. Only then is the rental price released to the owner. 4. The renter returns the car to the same hub by the end date. Staff inspect it and record the return. 5. The deposit is refunded to the renter, minus any damage deduction, which goes to the owner.',
        ],
      },
      {
        heading: 'Cancellation by the renter',
        paragraphs: [
          'More than 48 hours before the start date: full refund of the rental price and the deposit. Less than 48 hours before the start date: the deposit and half of the rental price are refunded. After the start date has begun, or if the renter does not collect the car: the deposit is refunded and the rental price is not.',
          'A booking that has not been paid when the payment window closes is cancelled automatically at no cost.',
        ],
      },
      {
        heading: 'Cancellation by the owner or by Via Nostra',
        paragraphs: [
          'If the owner or Via Nostra cancels a paid booking, the renter receives a full refund. Owners who cancel often may have their account reviewed.',
        ],
      },
      {
        heading: 'Late returns and extra costs',
        paragraphs: [
          'A car returned late may be charged for the extra time and may affect the owner\'s next booking. Fuel, cleaning, fines, tolls and parking charges during the rental are the renter\'s responsibility.',
        ],
      },
      {
        heading: 'Accidents and problems',
        paragraphs: [
          'Tell the hub immediately about any accident, damage, theft or breakdown and keep any documents or photos. Do not agree private payments outside Via Nostra. If something goes wrong with a booking, contact support at [support email].',
        ],
      },
    ],
  },
};

// File: frontend/lib/legal.ts
// END OF FILE