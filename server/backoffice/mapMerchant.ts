import type { Merchant, MerchantBrand } from "@shared/schema";
import { checkPayload, merchantPayloadSchema, type MerchantPayload } from "./contracts";

// Portal -> adapter contract (not yet an external HTTP API contract):
// id -> sourceRequestId; companyType/Name/NameAr -> company fields;
// brandName/Ar -> brand fields; crNumber -> commercialRegistrationNumber;
// contactPerson/email/phone/address/whatsapp -> contact;
// pocName/Phone/Email -> dailyOperationsContact;
// businessCategories/products/branches -> matching arrays;
// subscriptionFee/transactionFee/redemptionFee -> fees;
// logo/coverImage/CR/establishment/trade/tax/menu/contract/salesOrder -> assets;
// signatures/signatories/dates/stamp -> agreement;
// group merchant brands -> brand-specific details (no guessed single brand).
export function mapMerchant(merchant: Merchant, brands: MerchantBrand[] = []) {
  return {
    sourceRequestId: merchant.id,
    companyType: merchant.companyType,
    companyName: merchant.companyName,
    companyNameAr: merchant.companyNameAr,
    brandName: merchant.brandName,
    brandNameAr: merchant.brandNameAr,
    commercialRegistrationNumber: merchant.crNumber,
    contact: {
      name: merchant.contactPerson, email: merchant.email, phone: merchant.phone,
      address: merchant.address, whatsapp: merchant.whatsapp,
    },
    dailyOperationsContact: { name: merchant.pocName, email: merchant.pocEmail, phone: merchant.pocPhone },
    categories: merchant.businessCategories ?? [],
    products: merchant.products ?? [],
    branches: merchant.branches ?? [],
    fees: { subscription: merchant.subscriptionFee, transaction: merchant.transactionFee, redemption: merchant.redemptionFee },
    assets: {
      logo: merchant.logo, coverImage: merchant.coverImage, crDocument: merchant.crDocument,
      establishmentCard: merchant.establishmentCard, tradeLicense: merchant.tradeLicense,
      taxCardDocument: merchant.taxCardDocument, menuPriceList: merchant.menuPriceList,
      signedContract: merchant.signedContractUpload, salesOrder: merchant.salesOrder,
    },
    agreement: {
      merchantSignature: merchant.merchantSignature, merchantSignatoryName: merchant.merchantSignatoryName,
      companyStamp: merchant.companyStamp, merchantSignDate: merchant.merchantSignDate,
      commencementDate: merchant.commencementDate, qlSignature: merchant.qlSignature,
      qlName: merchant.qlName, qlTitle: merchant.qlTitle, qlSignDate: merchant.qlSignDate,
    },
    brands: brands.map(({ id, merchantId: _parent, ...brand }) => ({ sourceBrandId: id, ...brand })),
  };
}

export type MerchantSource = ReturnType<typeof mapMerchant>;

// Confirmed QA POST /admin/merchant-profiles mapping:
// companyName -> agencyName; contact.email/phone/whatsapp -> agencyEmail/
// contactMobile/contactWhatsapp; commercialRegistrationNumber -> crNumber;
// logo/coverImage/CR/tax documents -> corresponding URI fields.
// agencyId, userEmail, numeric category/location IDs, branch redemption settings
// and opening hours require explicit operator mappings; never infer account IDs
// from names or treat an establishment/trade DOCUMENT URL as its registration code.
export function prepareMerchantPayload(source: MerchantSource, mapping: Partial<MerchantPayload> = {}) {
  // Shared rules for every merchant. Only QA-specific, explicitly entered
  // details can supplement a source; identities/assets never come from a fixture.
  const { agencyId = 0, userEmail, categoryId, isPriceList = !!source.assets.menuPriceList, workingHours, branches } = mapping;
  const payload: Record<string, unknown> = {
    agencyName: mapping.agencyName ?? source.brandName,
    agencyEmail: mapping.agencyEmail ?? source.contact.email,
    contactMobile: mapping.contactMobile ?? source.contact.phone,
    contactWhatsapp: mapping.contactWhatsapp ?? source.contact.whatsapp ?? "",
    agencyLogoUri: mapping.agencyLogoUri ?? source.assets.logo ?? "",
    crNumber: mapping.crNumber ?? source.commercialRegistrationNumber ?? "",
    crUri: mapping.crUri ?? source.assets.crDocument ?? "",
    establishmentCardCode: "",
    tradeLicenseNumber: "",
    taxCardUri: source.assets.taxCardDocument ?? "",
    website: "", coverPhoto: mapping.coverPhoto ?? source.assets.coverImage ?? "", aboutAgency: mapping.aboutAgency ?? "",
    tagIds: [], config: {}, descriptionLength: (mapping.aboutAgency ?? "").length,
    agencyId, userEmail, categoryId, isPriceList, branches,
    ...(workingHours ? { workingHours } : {}),
  };
  const profileNames = [source.brandName, ...source.brands.map((brand) => brand.brandName)].filter(Boolean);
  if (source.companyType === "group" && mapping.agencyName && profileNames.includes(mapping.agencyName)) {
    payload.agencyName = mapping.agencyName;
  }
  const issues = source.companyType === "group" && (!mapping.agencyName || !profileNames.includes(mapping.agencyName))
    ? ["agencyName (select one of this group’s submitted brand names explicitly)"] : [];
  return checkPayload(merchantPayloadSchema, payload, issues);
}
