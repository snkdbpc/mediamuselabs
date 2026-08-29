import streamlit as st
from hashlib import sha256
import json
import os
from html import escape
from io import BytesIO
from uuid import uuid4

import requests
from PIL import Image
from pillow_heif import register_heif_opener

# Register HEIC/HEIF support with Pillow (must be called before any Image.open)
register_heif_opener()

# The Streamlit app is a client only.  Model execution, image storage,
# clustering, scoring, and post generation run in the FastAPI service.
API_BASE_URL = os.environ.get("MEDIAMIND_API_URL", "http://localhost:8000").rstrip("/")
API_PREFIX = "/api/v1"
MAX_UPLOAD_IMAGES = 30


def api_request(method, path, **kwargs):
    """Call the MediaMind FastAPI backend and return its JSON response."""
    try:
        response = requests.request(
            method,
            f"{API_BASE_URL}{API_PREFIX}{path}",
            timeout=180,
            **kwargs,
        )
        response.raise_for_status()
        return response.json()
    except requests.RequestException as exc:
        detail = ""
        if getattr(exc, "response", None) is not None:
            try:
                detail = exc.response.json().get("detail", "")
            except ValueError:
                detail = exc.response.text
        raise RuntimeError(f"MediaMind API request failed: {detail or exc}") from exc


def stream_social_posts(payload):
    """Yield parsed server-sent events while social copy is generated."""
    try:
        with requests.post(
            f"{API_BASE_URL}{API_PREFIX}/social-posts/generate/stream",
            json=payload,
            headers={"Accept": "text/event-stream"},
            stream=True,
            # The read timeout is reset whenever the backend emits an event.
            timeout=(10, 600),
        ) as response:
            response.raise_for_status()
            event_name = "message"
            data_lines = []
            for line in response.iter_lines(decode_unicode=True):
                if not line:
                    if data_lines:
                        yield event_name, json.loads("\n".join(data_lines))
                    event_name = "message"
                    data_lines = []
                elif line.startswith("event: "):
                    event_name = line[7:]
                elif line.startswith("data: "):
                    data_lines.append(line[6:])
    except (requests.RequestException, json.JSONDecodeError) as exc:
        raise RuntimeError(f"Unable to stream social copy: {exc}") from exc


def preview_image(uploaded_file):
    """Prepare a browser-uploaded image for display without invoking backend code."""
    image = Image.open(BytesIO(uploaded_file.getvalue())).convert("RGB")
    image.thumbnail((2048, 2048))
    return image


def social_account_connection(platform, widget_key, action_label=None):
    """Render a provider OAuth connection action without exposing credentials."""
    connection_id = st.session_state["social_connection_id"]
    try:
        status = api_request(
            "GET",
            f"/social-accounts/{platform}/status",
            params={"connection_id": connection_id},
        )
    except RuntimeError as exc:
        st.warning(f"Unable to check {platform.title()} connection: {exc}")
        return

    if status.get("connected"):
        if platform == "google" and status.get("picture"):
            avatar_col, name_col = st.columns([1, 4])
            with avatar_col:
                st.image(status["picture"], width=36)
            with name_col:
                st.success(f"Signed in as {status.get('name') or status.get('email')}")
        else:
            st.success(f"{platform.title()} account connected")
        return

    if platform == "google":
        # Use the current browser tab so OAuth returns directly to MediaMind.
        st.markdown(
            f"<a class='google-login-link' href='{API_BASE_URL}/auth/google?connection_id={connection_id}' target='_self'>"
            f"{action_label or 'Continue with Google'}</a>",
            unsafe_allow_html=True,
        )
        return

    auth_key = f"{platform}_authorize_url"
    button_label = action_label or f"Connect {platform.title()}"
    if st.button(button_label, key=f"connect_{platform}_{widget_key}", type="primary"):
        try:
            endpoint = "/social-accounts/facebook/sdk-login/url"
            result = api_request(
                "POST",
                endpoint,
                json={"connection_id": connection_id},
            )
            st.session_state[auth_key] = result["login_url"]
        except RuntimeError as exc:
            st.error(str(exc))

    if authorize_url := st.session_state.get(auth_key):
        st.link_button(
            f"Open {platform.title()} login",
            authorize_url,
            use_container_width=True,
            key=f"open_{platform}_{widget_key}",
        )
        st.caption("Log in or approve access in the new window, then refresh this page.")


def has_signed_in_social_account():
    """Uploads require a signed-in Google account."""
    return bool(google_account_status().get("connected"))


def google_account_status():
    """Fetch the safe Google profile data used in the header."""
    try:
        return api_request(
            "GET",
            "/social-accounts/google/status",
            params={"connection_id": st.session_state["social_connection_id"]},
        )
    except RuntimeError:
        return {"connected": False}


# -----------------------------
# Page Configuration
# -----------------------------
st.set_page_config(
    page_title="MediaMind AI - Smart Cluster & Post",
    page_icon="📸",
    layout="wide",
    initial_sidebar_state="expanded"
)

# -----------------------------
# Custom Premium Styling
# -----------------------------
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&family=Inter:wght@300;400;500;600&display=swap');
    
    html, body, [class*="css"] {
        font-family: 'Inter', sans-serif;
    }
    
    .main-header {
        font-family: 'Outfit', sans-serif;
        background: linear-gradient(135deg, #6366F1 0%, #A855F7 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        font-weight: 700;
        font-size: 3rem;
        margin-bottom: 0.5rem;
    }
    
    .sub-header {
        font-family: 'Outfit', sans-serif;
        color: #94A3B8;
        font-size: 1.2rem;
        margin-bottom: 2rem;
    }
    
    .card {
        background-color: #1E1E2F;
        border: 1px solid #334155;
        border-radius: 16px;
        padding: 24px;
        margin-bottom: 20px;
        box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -4px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
    }
    
    .card:hover {
        border-color: #6366F1;
        box-shadow: 0 20px 25px -5px rgba(99, 102, 241, 0.1), 0 8px 10px -6px rgba(99, 102, 241, 0.1);
    }
    
    .step-indicator {
        display: flex;
        justify-content: space-between;
        margin-bottom: 2rem;
        padding: 10px;
        background: #111827;
        border-radius: 12px;
        border: 1px solid #374151;
    }
    
    .step-item {
        flex: 1;
        text-align: center;
        padding: 10px;
        font-size: 0.9rem;
        font-weight: 600;
        color: #4B5563;
        border-radius: 8px;
    }
    
    .step-active {
        background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%);
        color: white;
    }
    
    .badge {
        background: #312E81;
        color: #C7D2FE;
        padding: 4px 8px;
        border-radius: 6px;
        font-size: 0.75rem;
        font-weight: bold;
        text-transform: uppercase;
        display: inline-block;
        margin-bottom: 10px;
    }

    .stButton>button {
        border-radius: 10px !important;
        padding: 0.5rem 1.5rem !important;
        font-weight: 600 !important;
        transition: all 0.2s ease-in-out !important;
    }
    
    .stButton>button[kind="primary"] {
        background: linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%) !important;
        border: none !important;
        color: white !important;
    }
    
    .stButton>button[kind="primary"]:hover {
        transform: translateY(-2px) !important;
        box-shadow: 0 8px 20px rgba(99, 102, 241, 0.4) !important;
    }

    .google-login-link {
        display: block;
        box-sizing: border-box;
        width: 100%;
        padding: 0.65rem 1rem;
        border: 1px solid #D1D5DB;
        border-radius: 10px;
        background: white;
        color: #111827 !important;
        text-align: center;
        text-decoration: none !important;
        font-weight: 600;
    }
    .google-login-link:hover { background: #F9FAFB; border-color: #9CA3AF; }

    .profile-avatar img {
        width: 46px;
        height: 46px;
        object-fit: cover;
        border-radius: 50%;
        margin: 0;
    }

    .confidence-high {
        display: inline-block;
        background: #065F46;
        color: #D1FAE5;
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 0.78rem;
        font-weight: 600;
        margin-left: 8px;
    }
    .confidence-medium {
        display: inline-block;
        background: #78350F;
        color: #FDE68A;
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 0.78rem;
        font-weight: 600;
        margin-left: 8px;
    }
    .confidence-low {
        display: inline-block;
        background: #7F1D1D;
        color: #FECACA;
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 0.78rem;
        font-weight: 600;
        margin-left: 8px;
    }

    .remove-label {
        font-size: 0.72rem;
        color: #F87171;
        text-align: center;
    }
</style>
""", unsafe_allow_html=True)

# -----------------------------
# Initialize Session State
# -----------------------------
if connection_id := st.query_params.get("connection_id"):
    # OAuth returns here with the original UI connection id. Keep it in the
    # URL so a browser reload can restore the same authenticated session.
    st.session_state["social_connection_id"] = connection_id
if "current_step" not in st.session_state:
    st.session_state["current_step"] = "upload"
if "pil_images" not in st.session_state:
    st.session_state["pil_images"] = []
if "image_filenames" not in st.session_state:
    st.session_state["image_filenames"] = []
if "album_description" not in st.session_state:
    st.session_state["album_description"] = ""
if "removed_indices" not in st.session_state:
    st.session_state["removed_indices"] = set()
if "clusters" not in st.session_state:
    st.session_state["clusters"] = []
if "generated_posts" not in st.session_state:
    st.session_state["generated_posts"] = {}
if "selected_best_images" not in st.session_state:
    st.session_state["selected_best_images"] = {}
if "album_id" not in st.session_state:
    st.session_state["album_id"] = None
if "upload_fingerprint" not in st.session_state:
    st.session_state["upload_fingerprint"] = None
if "scored_cluster_metadata" not in st.session_state:
    st.session_state["scored_cluster_metadata"] = {}
if "social_connection_id" not in st.session_state:
    st.session_state["social_connection_id"] = str(uuid4())
if st.query_params.get("connection_id") != st.session_state["social_connection_id"]:
    st.query_params["connection_id"] = st.session_state["social_connection_id"]
if "upload_widget_version" not in st.session_state:
    st.session_state["upload_widget_version"] = 0

# Helper to go to next step
def set_step(step):
    st.session_state["current_step"] = step

# Helper to reset the app
def reset_app():
    st.session_state["current_step"] = "upload"
    st.session_state["pil_images"] = []
    st.session_state["image_filenames"] = []
    st.session_state["album_description"] = ""
    st.session_state["removed_indices"] = set()
    st.session_state["clusters"] = []
    st.session_state["generated_posts"] = {}
    st.session_state["selected_best_images"] = {}
    st.session_state["album_id"] = None
    st.session_state["upload_fingerprint"] = None
    st.session_state["scored_cluster_metadata"] = {}

# Helper: confidence pill HTML
def confidence_pill(avg_similarity):
    if avg_similarity >= 0.75:
        return f"<span class='confidence-high'>🟢 High Cohesion ({avg_similarity:.2f})</span>"
    elif avg_similarity >= 0.55:
        return f"<span class='confidence-medium'>🟡 Medium Cohesion ({avg_similarity:.2f})</span>"
    else:
        return f"<span class='confidence-low'>🔴 Low Cohesion ({avg_similarity:.2f})</span>"

# -----------------------------
# Sidebar
# -----------------------------
with st.sidebar:
    st.markdown("<h2 style='font-family: Outfit; font-weight:600;'>✦ Creator profile</h2>", unsafe_allow_html=True)
    st.caption("This profile guides every generated caption.")

    user_type = st.selectbox(
        "User type",
        ["Individual", "Creator / Influencer", "Business / Brand", "Organization"],
    )
    creator_name = st.text_input("Name", placeholder="e.g. Aisha Sharma or Wild Trails Co.")
    profession = st.text_input("Profession", placeholder="e.g. Wildlife photographer")
    content_type = st.selectbox(
        "Social media content to generate",
        ["Social post", "Promotional post", "Educational post", "Storytelling post", "Product showcase", "Event announcement"],
    )
    target_audience = st.text_input(
        "Target audience",
        placeholder="e.g. Nature lovers and aspiring photographers",
    )
    target_age_group = st.selectbox(
        "Target age group",
        ["13–17", "18–24", "25–34", "35–44", "45–54", "55+", "All ages"],
    )

    creator_profile = {
        "user_type": user_type,
        "name": creator_name.strip(),
        "profession": profession.strip(),
        "content_type": content_type,
        "target_audience": target_audience.strip(),
        "target_age_group": target_age_group,
    }

    # These workflow defaults are intentionally fixed; model configuration is
    # no longer exposed in the creator-profile panel.
    embedding_model = "SigLIP"
    caption_model = "Florence-2"
    project_name = creator_profile["name"] or creator_profile["profession"] or "MediaMind posts"
    
# -----------------------------
# Header
# -----------------------------
avatar_col, header_col, account_col = st.columns([0.45, 5, 1.3])
with avatar_col:
    google_account = google_account_status()
    if google_account.get("connected") and google_account.get("picture"):
        st.markdown(
            f"<div class='profile-avatar'><img src='{escape(google_account['picture'], quote=True)}' alt='Google profile'></div>",
            unsafe_allow_html=True,
        )
with header_col:
    st.markdown("<div class='main-header'>MediaMind AI</div>", unsafe_allow_html=True)
    profile_label = creator_profile["name"] or creator_profile["profession"] or "your visual story"
    st.markdown(f"<div class='sub-header'>Organize <b>{profile_label}</b> and create social media content that fits your audience.</div>", unsafe_allow_html=True)
if not google_account.get("connected"):
    with account_col:
        social_account_connection("google", "header", "🔵 Connect with Google")

# Step Indicator Visualizer
steps = ["1. Upload & Preview", "2. Generate Social Copy", "3. Finalize & Share"]
step_indices = {"upload": 0, "choose": 1, "edit": 1, "finalize": 2}
current_idx = step_indices[st.session_state["current_step"]]

cols = st.columns(3)
for i, step_name in enumerate(steps):
    with cols[i]:
        st.markdown(f"""
        <div style="text-align: center; padding: 12px; font-weight: 600; border-radius: 8px; border: 1px solid #374151;
        background: {'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)' if i == current_idx else '#1E1E2F'};
        color: {'white' if i == current_idx else '#94A3B8'};">
            {step_name}
        </div>
        """, unsafe_allow_html=True)

# Keep the current workflow state visible after the upload screen.
workflow_status = {
    "choose": (2 / 3, "Album analyzed — choose whether to review clusters or generate social copy."),
    "edit": (2 / 3, "Reviewing clusters — update details, then generate social copy when ready."),
    "finalize": (1.0, "Social Media Center — generating or reviewing your social posts."),
}
if st.session_state["current_step"] in workflow_status:
    progress_value, progress_text = workflow_status[st.session_state["current_step"]]
    st.progress(progress_value, text=progress_text)

st.markdown("<br>", unsafe_allow_html=True)

# -----------------------------
# Step 1: Upload & Preview
# -----------------------------
if st.session_state["current_step"] == "upload":
    st.subheader("📥 Upload Album")
    is_signed_in = has_signed_in_social_account()
    if not is_signed_in:
        st.warning("Use Connect with Google before uploading images.")

    uploaded_files = st.file_uploader(
        f"Choose up to {MAX_UPLOAD_IMAGES} images to analyze and cluster",
        type=["jpg", "jpeg", "png", "heic", "webp"],
        accept_multiple_files=True,
        disabled=not is_signed_in,
        key=f"album_upload_{st.session_state['upload_widget_version']}",
        help=f"You can select a maximum of {MAX_UPLOAD_IMAGES} images in one upload.",
    )
    
    if uploaded_files and len(uploaded_files) > MAX_UPLOAD_IMAGES:
        st.error(f"Please select no more than {MAX_UPLOAD_IMAGES} images.")
    elif uploaded_files:
        # Upload the original files once to FastAPI.  The UI only retains
        # down-sized PIL images for previews and does not access storage itself.
        upload_fingerprint = tuple(
            (file.name, len(file.getvalue()), sha256(file.getvalue()).hexdigest())
            for file in uploaded_files
        )
        pil_imgs = []
        filenames = []
        progress = st.progress(0)
        for idx, file in enumerate(uploaded_files):
            try:
                resized_img = preview_image(file)
                progress.progress((idx + 1) / len(uploaded_files))
            except Exception as img_err:
                st.warning(f"⚠️ Could not open `{file.name}`: {img_err}. Skipping.")
                continue
            pil_imgs.append(resized_img)
            filenames.append(file.name)

        if not pil_imgs:
            st.error("No supported images could be loaded.")
            st.stop()

        if st.session_state["upload_fingerprint"] != upload_fingerprint:
            try:
                multipart_files = [
                    (
                        "files",
                        (file.name, file.getvalue(), file.type or "application/octet-stream"),
                    )
                    for file in uploaded_files
                ]
                upload_result = api_request(
                    "POST",
                    "/albums/upload",
                    files=multipart_files,
                    data={"connection_id": st.session_state["social_connection_id"]},
                )
                st.session_state["album_id"] = upload_result["album_id"]
                st.session_state["upload_fingerprint"] = upload_fingerprint
            except (KeyError, RuntimeError) as exc:
                st.error(f"Unable to upload the album to the backend: {exc}")
                st.stop()

        st.session_state["pil_images"] = pil_imgs
        st.session_state["image_filenames"] = filenames

        # Reset removed indices when new images are uploaded
        if len(pil_imgs) != len(st.session_state.get("_last_upload_count", [])):
            st.session_state["removed_indices"] = set()
        st.session_state["_last_upload_count"] = pil_imgs

        upload_status_col, reupload_col = st.columns([4, 1])
        with upload_status_col:
            st.success(f"✅ {len(uploaded_files)} images loaded. Deselect any you'd like to exclude, then click Analyze.")
        with reupload_col:
            if st.button("↻ Re-upload images", use_container_width=True):
                reset_app()
                st.session_state["upload_widget_version"] += 1
                st.rerun()
        
        st.markdown("#### 🖼️ Preview Album")
        st.caption("Uncheck images to exclude them from clustering.")

        # Image preview grid with remove checkboxes
        cols_preview = st.columns(6)
        for idx, (img, name) in enumerate(zip(pil_imgs, filenames)):
            with cols_preview[idx % 6]:
                st.image(img, use_container_width=True)
                include = st.checkbox(
                    "Include",
                    value=(idx not in st.session_state["removed_indices"]),
                    key=f"include_{idx}_{name}"
                )
                if not include:
                    st.session_state["removed_indices"].add(idx)
                else:
                    st.session_state["removed_indices"].discard(idx)
                st.caption(name)

        # ---- Album-level description ----
        active_indices = [i for i in range(len(pil_imgs)) if i not in st.session_state["removed_indices"]]
        excluded_count = len(pil_imgs) - len(active_indices)

        if excluded_count > 0:
            st.info(f"ℹ️ {excluded_count} image(s) excluded from clustering.")

        st.markdown("---")
        album_description = st.text_area(
            "📝 Album Description (optional)",
            value=st.session_state.get("album_description", ""),
            placeholder="e.g. Safari expedition in Bandhavgarh — tigers, deer, and golden-hour landscapes shot in June 2026.",
            height=90,
            help="A short description of the whole album. It helps the AI generate richer cluster captions and social media posts."
        )
        st.session_state["album_description"] = album_description

        
        col1, col2 = st.columns([3, 1])
        with col2:
            if st.button("🚀 Analyze & Cluster Images", type="primary", use_container_width=True):
                if len(active_indices) < 1:
                    st.error("Please include at least 1 image before clustering.")
                else:
                    album_desc = st.session_state.get("album_description", "").strip()
                    with st.spinner("Initializing models and analyzing images..."):
                        try:
                            if not st.session_state["album_id"]:
                                raise RuntimeError("Upload the album before requesting clustering.")
                            cluster_result = api_request(
                                "POST",
                                f"/albums/{st.session_state['album_id']}/clusters",
                                json={
                                    "filenames": [filenames[i] for i in active_indices],
                                    "image_index_by_filename": {
                                        filenames[i]: i for i in active_indices
                                    },
                                    "embedding_model": embedding_model,
                                    "caption_model": caption_model,
                                    "album_description": album_desc,
                                },
                            )
                            editable_clusters = cluster_result.get("clusters", [])
                            if not editable_clusters:
                                raise RuntimeError("No clustered images are available for editing.")

                            st.session_state["clusters"] = editable_clusters
                            st.session_state["scored_cluster_metadata"] = {}
                            st.session_state["selected_best_images"] = {
                                cluster["cluster_id"]: min(3, len(cluster["all_image_indices"]))
                                for cluster in editable_clusters
                            }
                            # Let users decide whether to review clusters before
                            # starting the streamed social-copy generation.
                            set_step("choose")
                            st.rerun()

                        except Exception as e:
                            st.error(f"Error during clustering: {e}")
                            st.exception(e)
    else:
        if is_signed_in:
            st.info(f"👈 Upload up to {MAX_UPLOAD_IMAGES} images to get started.")

# -----------------------------
# Step 2: Choose the next step
# -----------------------------
elif st.session_state["current_step"] == "choose":
    st.subheader("What would you like to do next?")
    st.write("You can generate social copy immediately or review and refine the detected clusters first.")
    review_col, generate_col = st.columns(2)
    with review_col:
        if st.button("✏️ Review Clusters", use_container_width=True):
            set_step("edit")
            st.rerun()
    with generate_col:
        if st.button("✨ Generate Social Copy", type="primary", use_container_width=True):
            set_step("finalize")
            st.rerun()

# -----------------------------
# Step 2: Edit & Refine Clusters
# -----------------------------
elif st.session_state["current_step"] == "edit":
    st.subheader("✏️ Review and Edit Clusters")
    st.write("We've grouped your photos automatically. Edit cluster tags and add tags or descriptions to each image.")
    
    clusters = st.session_state["clusters"]
    
    if not clusters:
        st.warning("No clusters found. Please return to Step 1.")
        if st.button("Back to Upload"):
            set_step("upload")
            st.rerun()
    else:
        for idx, cluster in enumerate(clusters):
            c_id = cluster["cluster_id"]
            
            st.markdown(f"<div class='card'>", unsafe_allow_html=True)
            tags_str = st.text_input(
                "Cluster tags (comma separated)",
                value=", ".join(cluster.get("tags", [])),
                key=f"tags_{c_id}",
            )

            cluster["tags"] = [tag.strip() for tag in tags_str.split(",") if tag.strip()]

            st.markdown("##### 🖼️ Images")
            image_details = cluster.setdefault("image_details", {})
            grid_cols = st.columns(3)
            for grid_idx, img_idx in enumerate(cluster["all_image_indices"]):
                # FastAPI serializes dictionary keys as strings. Cluster image
                # indices are integers in the Streamlit session, so accept the
                # API key and cache it under the local integer key.
                image_detail = image_details.get(img_idx)
                if image_detail is None:
                    image_detail = image_details.get(str(img_idx), {
                        "description": "", "tags": [], "image_location": ""
                    })
                    image_details[img_idx] = image_detail
                with grid_cols[grid_idx % 3]:
                    st.image(st.session_state["pil_images"][img_idx], use_container_width=True)
                    st.caption(st.session_state["image_filenames"][img_idx])
                    image_tags = st.text_input(
                        "Image tags",
                        value=", ".join(image_detail.get("tags", [])),
                        placeholder="e.g. tiger, forest, wildlife",
                        key=f"image_tags_{c_id}_{img_idx}",
                    )
                    image_description = st.text_area(
                        "Image description",
                        value=image_detail.get("description", ""),
                        placeholder="Describe this image.",
                        height=90,
                        key=f"image_desc_{c_id}_{img_idx}",
                    )
                    image_location = st.text_area(
                        "Image location",
                        value=image_detail.get("image_location", ""),
                        placeholder="Location of this image.",
                        height=90,
                        key=f"image_location_{c_id}_{img_idx}",
                    )
                    image_detail["tags"] = [tag.strip() for tag in image_tags.split(",") if tag.strip()]
                    image_detail["description"] = image_description
                    image_detail["image_location"] = image_location
                            
            st.markdown("</div>", unsafe_allow_html=True)
            st.markdown("<br>", unsafe_allow_html=True)
            
        st.markdown("---")
        
        col1, col2 = st.columns([1, 1])
        with col1:
            if st.button("⬅️ Back to Upload", use_container_width=True):
                set_step("upload")
                st.rerun()
        with col2:
            if st.button("✨ Generate Social Copy & Finalize", type="primary", use_container_width=True):
                n = len(clusters)
                with st.spinner(f"Generating creative copy for {n} cluster{'s' if n != 1 else ''} in parallel…"):
                    try:
                        generated_result = api_request(
                            "POST",
                            "/social-posts/generate",
                            json={
                                "album_id": st.session_state["album_id"],
                                "clusters": clusters,
                                "creator_profile": creator_profile,
                                "max_workers": min(n, 5),
                            },
                        )
                        st.session_state["generated_posts"] = generated_result.get("posts", {})
                        st.session_state["scored_cluster_metadata"] = {}
                        set_step("finalize")
                        st.rerun()
                    except RuntimeError as exc:
                        st.error(f"Unable to generate social copy: {exc}")


# -----------------------------
# Step 3: Finalize & Share
# -----------------------------
elif st.session_state["current_step"] == "finalize":
    st.subheader("📢 Social Media Center")
    st.write("Your social copy appears as each cluster completes, so you can follow progress without waiting for the full batch.")
    
    clusters = st.session_state["clusters"]
    posts_data = st.session_state["generated_posts"]
    
    if not clusters:
        st.warning("No clusters found. Please upload and analyze an album first.")
        if st.button("Back to Upload"):
            set_step("upload")
            st.rerun()
    else:
        if not posts_data:
            total_clusters = len(clusters)
            progress = st.progress(0, text="Starting social-copy generation…")
            live_output = st.empty()
            generated_posts = {}
            streamed_sections = []
            try:
                for event, payload in stream_social_posts(
                    {
                        "album_id": st.session_state["album_id"],
                        "clusters": clusters,
                        "creator_profile": creator_profile,
                        "max_workers": min(total_clusters, 5),
                    }
                ):
                    if event == "post":
                        cluster_id = payload["cluster_id"]
                        generated_posts[str(cluster_id)] = payload["post"]
                        progress.progress(
                            payload["completed"] / payload["total"],
                            text=f"Generated social copy for cluster {payload['completed']} of {payload['total']}",
                        )
                        streamed_sections.append(
                            f"### Cluster {cluster_id}\n\n{payload['post']['facebook_post']}"
                        )
                        live_output.markdown(
                            "\n\n---\n\n".join(streamed_sections)
                        )
                    elif event == "error":
                        st.warning(
                            f"Could not generate copy for cluster {payload['cluster_id']}: "
                            f"{payload['message']}"
                        )
                if not generated_posts:
                    raise RuntimeError("The backend did not return any social posts.")
                st.session_state["generated_posts"] = generated_posts
                st.session_state["scored_cluster_metadata"] = {}
                # `posts_data` was read before streaming began; refresh it so
                # the Finalize & Share controls receive the completed posts.
                posts_data = st.session_state["generated_posts"]
                progress.empty()
                live_output.empty()
            except RuntimeError as exc:
                progress.empty()
                st.error(str(exc))
                st.stop()

        # The existing final-screen UI follows after generation completes.
        # The backend retains the graph and embedding state created during
        # clustering, then ranks images when this endpoint is requested.
        if not st.session_state["scored_cluster_metadata"]:
            if not st.session_state["album_id"]:
                st.error("The album session is unavailable. Please upload and cluster again.")
                st.stop()
            best_n_to_score = max(len(cluster["all_image_indices"]) for cluster in clusters)
            with st.spinner("Scoring image quality and selecting the best images..."):
                try:
                    scoring_result = api_request(
                        "POST",
                        f"/albums/{st.session_state['album_id']}/scores",
                        json={"clusters": clusters, "n": best_n_to_score},
                    )
                    st.session_state["scored_cluster_metadata"] = scoring_result.get(
                        "scored_clusters", {}
                    )
                except RuntimeError as exc:
                    st.error(f"Unable to score images: {exc}")
                    st.stop()

        scored_cluster_metadata = st.session_state["scored_cluster_metadata"]

        # ---- Download All Posts button ----
        def build_download_text():
            lines = [f"MediaMind AI — Generated Posts for {project_name}\n{'='*60}\n"]
            for cluster in clusters:
                c_id = cluster["cluster_id"]
                posts = posts_data.get(str(c_id), posts_data.get(c_id, {}))
                lines.append(f"\n{'—'*40}")
                lines.append(f"CLUSTER: {cluster['name']}")
                lines.append(f"{'—'*40}\n")
                lines.append("📘 FACEBOOK POST:")
                lines.append(posts.get("facebook_post", "") + "\n")
                lines.append("📸 INSTAGRAM CAPTION:")
                lines.append(posts.get("instagram_caption", "") + "\n")
                lines.append("🐦 TWITTER/X POST:")
                lines.append(posts.get("twitter_post", "") + "\n")
                lines.append("🏷️ HASHTAGS:")
                lines.append(" ".join(posts.get("hashtags", [])) + "\n")
                lines.append("🔍 SEO ALT TEXT:")
                lines.append(posts.get("seo_alt_text", "") + "\n")
            return "\n".join(lines)

        download_col, _ = st.columns([1, 3])
        with download_col:
            st.download_button(
                label="⬇️ Download All Posts (.txt)",
                data=build_download_text(),
                file_name=f"{project_name.replace(' ', '_')}_posts.txt",
                mime="text/plain",
                use_container_width=True
            )

        st.markdown("<br>", unsafe_allow_html=True)

        for idx, cluster in enumerate(clusters):
            c_id = cluster["cluster_id"]
            posts = posts_data.get(str(c_id), posts_data.get(c_id, {}))
            
            st.markdown("<div class='card'>", unsafe_allow_html=True)
            st.markdown(f"<h4>📌 {cluster['name']}</h4>", unsafe_allow_html=True)
            max_images_in_cluster = len(cluster["all_image_indices"])
            if max_images_in_cluster == 0:
                st.warning("This cluster has no available images.")
                st.markdown("</div>", unsafe_allow_html=True)
                continue

            saved_best_n = st.session_state["selected_best_images"].get(c_id, 3)
            default_best_n = max(1, min(saved_best_n, max_images_in_cluster))
            slider_key = f"top_n_final_{c_id}"
            allowed_best_n = list(range(1, max_images_in_cluster + 1))
            if st.session_state.get(slider_key) not in allowed_best_n:
                st.session_state[slider_key] = default_best_n
            best_n = st.selectbox(
                "Select top N images",
                options=allowed_best_n,
                key=slider_key,
            )
            st.session_state["selected_best_images"][c_id] = best_n
            
            # Show the best N images returned by the backend score service.
            scored_representatives = scored_cluster_metadata.get(
                str(c_id), scored_cluster_metadata.get(c_id, {})
            ).get("representatives", [])
            image_index_by_filename = {
                filename: image_index
                for image_index, filename in enumerate(st.session_state["image_filenames"])
            }
            selected_images = [
                (image_index_by_filename.get(os.path.basename(rep["path"])), rep)
                for rep in scored_representatives[:best_n]
            ]
            selected_images = [
                (image_index, rep)
                for image_index, rep in selected_images
                if image_index is not None
            ]
            
            st.markdown("##### 🌟 Selected Best N Images")
            img_cols = st.columns(max(3, len(selected_images)))
            for g_idx, (img_idx, representative) in enumerate(selected_images):
                img = st.session_state["pil_images"][img_idx]
                filename = st.session_state["image_filenames"][img_idx]
                with img_cols[g_idx % len(img_cols)]:
                    st.image(img, use_container_width=True)
                    st.caption(
                        f"Rank {g_idx + 1} — {filename} · "
                        f"Score: {representative['quality_score']:.2f}"
                    )
                    
            st.markdown("<br>", unsafe_allow_html=True)
            
            st.markdown("##### 📝 Edit & Review Generated Posts")
            fb_text = st.text_area(
                "Facebook Post Caption",
                value=posts.get("facebook_post", ""),
                height=200,
                key=f"fb_edit_{c_id}"
            )
            posts["facebook_post"] = fb_text
            
            social_account_connection("facebook", c_id, "💙 Share to Facebook")
                
            st.markdown("</div>", unsafe_allow_html=True)
            st.markdown("<br>", unsafe_allow_html=True)
            
        st.markdown("---")
        
        col1, col2 = st.columns([1, 1])
        with col1:
            if st.button("⬅️ Back to Upload", use_container_width=True):
                set_step("upload")
                st.rerun()
        with col2:
            if st.button("🔄 Start New Project", use_container_width=True):
                reset_app()
                st.rerun()
