import * as nodeApi from "./api.js";

// # Active data provider
let provider = "local";
let supabaseClient;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
const hasSupabaseConfig = Boolean(supabaseUrl && supabaseKey);

async function getSupabase() {
  if (!hasSupabaseConfig) return null;
  if (!supabaseClient) {
    const { createSupabaseClient } = await import("./supabase.js");
    supabaseClient = createSupabaseClient(supabaseUrl, supabaseKey);
  }
  return supabaseClient;
}

function unwrap(result, fallbackMessage) {
  if (result.error) {
    throw new nodeApi.ApiError(
      result.error.message || fallbackMessage,
      400,
      "SUPABASE_REQUEST_FAILED",
    );
  }
  return result.data;
}

async function getSupabaseContext() {
  const supabase = await getSupabase();
  const data = unwrap(
    await supabase.rpc("toolstead_get_context"),
    "The Toolstead workspace could not be loaded.",
  );
  if (!data?.workspace?.id) {
    throw new nodeApi.ApiError(
      "Your authenticated account is not linked to a Toolstead workspace.",
      403,
      "WORKSPACE_NOT_PROVISIONED",
    );
  }
  return data;
}

// # Connection discovery
export async function establishConnection() {
  if (hasSupabaseConfig) {
    provider = "supabase";
    const supabase = await getSupabase();
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) return { state: "auth", provider };
    const verified = await supabase.auth.getUser();
    if (verified.error || !verified.data.user) {
      await supabase.auth.signOut({ scope: "local" });
      return { state: "auth", provider };
    }
    return { state: "supabase", provider, account: await getSupabaseContext() };
  }

  try {
    await nodeApi.checkApi();
    provider = "api";
    try {
      const account = await nodeApi.getCurrentAccount();
      return { state: "api", provider, account };
    } catch (error) {
      if (error instanceof nodeApi.ApiError && error.status === 401) {
        return { state: "auth", provider };
      }
      throw error;
    }
  } catch {
    provider = "local";
    return { state: "local", provider };
  }
}

// # Authentication
export async function signIn(credentials) {
  if (provider === "supabase") {
    const supabase = await getSupabase();
    unwrap(
      await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      }),
      "The email or password is incorrect.",
    );
    return getSupabaseContext();
  }
  return nodeApi.login(credentials);
}

export async function signUp(registration) {
  if (provider !== "supabase") {
    throw new nodeApi.ApiError(
      "Owner registration requires the Supabase connection.",
      503,
      "REGISTRATION_UNAVAILABLE",
    );
  }
  const supabase = await getSupabase();
  const data = unwrap(
    await supabase.auth.signUp({
      email: registration.email,
      password: registration.password,
      options: {
        emailRedirectTo: window.location.origin,
        data: {
          display_name: registration.displayName,
          workspace_name: registration.workspaceName,
        },
      },
    }),
    "The owner account could not be created.",
  );
  if (!data.session) {
    return { verificationRequired: true, email: registration.email };
  }
  return { account: await getSupabaseContext() };
}

export async function signOut() {
  if (provider === "supabase") {
    const supabase = await getSupabase();
    unwrap(await supabase.auth.signOut(), "Sign out failed.");
    return;
  }
  if (provider === "api") await nodeApi.logout();
}

// # Module catalog
export async function getModules() {
  if (provider === "supabase") {
    const supabase = await getSupabase();
    const modules = unwrap(
      await supabase.rpc("toolstead_list_modules"),
      "The Tool Library could not be loaded.",
    );
    return { modules: modules || [] };
  }
  return nodeApi.getModules();
}

// # Contact directory
export async function getContacts(query = "") {
  if (provider === "supabase") {
    const supabase = await getSupabase();
    const contacts = unwrap(
      await supabase.rpc("toolstead_list_contacts", { p_query: query }),
      "The contact directory could not be loaded.",
    );
    return { contacts: contacts || [] };
  }
  return nodeApi.getContacts(query);
}

export async function createContact(contact) {
  if (provider === "supabase") {
    const supabase = await getSupabase();
    const id = unwrap(
      await supabase.rpc("toolstead_create_contact", {
        p_display_name: contact.displayName,
        p_company_name: contact.companyName || null,
        p_email: contact.email || null,
        p_phone: contact.phone || null,
        p_source: contact.source,
        p_summary: contact.summary || null,
        p_lifecycle_stage: contact.stage || "New lead",
      }),
      "The lead could not be created.",
    );
    return { contact: { id } };
  }
  return nodeApi.createContact(contact);
}

export async function updateContact(contactId, contact) {
  if (provider === "supabase") {
    const supabase = await getSupabase();
    unwrap(
      await supabase.rpc("toolstead_update_contact", {
        p_contact_id: contactId,
        p_display_name: contact.displayName,
        p_company_name: contact.companyName || null,
        p_email: contact.email || null,
        p_phone: contact.phone || null,
        p_source: contact.source,
        p_lifecycle_stage: contact.stage || "New lead",
      }),
      "The contact could not be updated.",
    );
    return { contact: { id: contactId } };
  }
  return nodeApi.updateContact(contactId, contact);
}

export async function addContactNote(contactId, body) {
  if (provider === "supabase") {
    const supabase = await getSupabase();
    unwrap(
      await supabase.rpc("toolstead_add_contact_note", {
        p_contact_id: contactId,
        p_body: body,
      }),
      "The note could not be added.",
    );
    return;
  }
  return nodeApi.addContactNote(contactId, body);
}

export async function archiveContact(contactId) {
  if (provider === "supabase") {
    const supabase = await getSupabase();
    unwrap(
      await supabase.rpc("toolstead_archive_contact", {
        p_contact_id: contactId,
      }),
      "The contact could not be archived.",
    );
    return;
  }
  return nodeApi.archiveContact(contactId);
}

export function isPersistentProvider() {
  return provider === "supabase" || provider === "api";
}

export function requiresRemoteConnection() {
  return hasSupabaseConfig;
}

export function supportsSelfRegistration() {
  return provider === "supabase";
}
