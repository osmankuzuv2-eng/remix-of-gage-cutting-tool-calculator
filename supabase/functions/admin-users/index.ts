import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await callerClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = claimsData.claims.sub;

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, ...params } = await req.json();

    switch (action) {
      case "list_users": {
        const { data, error } = await supabaseAdmin.auth.admin.listUsers();
        if (error) throw error;

        // Get profiles, roles, permissions
        const userIds = data.users.map((u) => u.id);
        const [profiles, roles, permissions] = await Promise.all([
          supabaseAdmin.from("profiles").select("*").in("user_id", userIds),
          supabaseAdmin.from("user_roles").select("*").in("user_id", userIds),
          supabaseAdmin.from("user_module_permissions").select("*").in("user_id", userIds),
        ]);

        const users = data.users.map((u) => {
          const profile = profiles.data?.find((p) => p.user_id === u.id) || null;
          return {
            id: u.id,
            email: u.email,
            created_at: u.created_at,
            profile,
            roles: roles.data?.filter((r) => r.user_id === u.id).map((r) => r.role) || [],
            permissions: permissions.data?.filter((p) => p.user_id === u.id) || [],
          };
        });

        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create_user": {
        const { email, password, display_name, is_admin, module_permissions } = params;
        
        if (!email || !password) {
          return new Response(JSON.stringify({ error: "Email and password required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { display_name: display_name || email.split("@")[0] },
        });
        if (createError) throw createError;

        // Set admin role if requested
        if (is_admin) {
          await supabaseAdmin.from("user_roles").update({ role: "admin" }).eq("user_id", newUser.user.id);
        }

        // Set module permissions
        if (module_permissions && Array.isArray(module_permissions)) {
          const perms = module_permissions.map((mp: { module_key: string; granted: boolean }) => ({
            user_id: newUser.user.id,
            module_key: mp.module_key,
            granted: mp.granted,
          }));
          if (perms.length > 0) {
            await supabaseAdmin.from("user_module_permissions").insert(perms);
          }
        }

        return new Response(JSON.stringify({ user: newUser.user }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_user": {
        const { user_id, email, display_name, is_admin, module_permissions, custom_title, title_color } = params;

        if (!user_id) {
          return new Response(JSON.stringify({ error: "user_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Update auth email if changed
        if (email) {
          await supabaseAdmin.auth.admin.updateUserById(user_id, { email });
        }

        // Update profile (display_name, custom_title, title_color)
        const profileUpdate: Record<string, unknown> = {};
        if (display_name !== undefined) profileUpdate.display_name = display_name;
        if (custom_title !== undefined) profileUpdate.custom_title = custom_title || null;
        if (title_color !== undefined) profileUpdate.title_color = title_color || null;
        if (Object.keys(profileUpdate).length > 0) {
          await supabaseAdmin.from("profiles").update(profileUpdate).eq("user_id", user_id);
        }

        // Update role
        if (is_admin !== undefined) {
          await supabaseAdmin.from("user_roles").update({ role: is_admin ? "admin" : "user" }).eq("user_id", user_id);
        }

        // Update module permissions
        if (module_permissions && Array.isArray(module_permissions)) {
          // Delete existing then insert new
          await supabaseAdmin.from("user_module_permissions").delete().eq("user_id", user_id);
          const perms = module_permissions.map((mp: { module_key: string; granted: boolean }) => ({
            user_id,
            module_key: mp.module_key,
            granted: mp.granted,
          }));
          if (perms.length > 0) {
            await supabaseAdmin.from("user_module_permissions").insert(perms);
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "change_password": {
        const { user_id, new_password } = params;
        if (!user_id || !new_password) {
          return new Response(JSON.stringify({ error: "user_id and new_password required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabaseAdmin.auth.admin.updateUserById(user_id, {
          password: new_password,
        });
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "delete_user": {
        const { user_id } = params;
        if (!user_id) {
          return new Response(JSON.stringify({ error: "user_id required" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error } = await supabaseAdmin.auth.admin.deleteUser(user_id);
        if (error) throw error;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
