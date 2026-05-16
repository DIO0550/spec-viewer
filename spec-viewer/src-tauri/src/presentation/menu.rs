use tauri::{
    menu::{
        AboutMetadata, IsMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu, HELP_SUBMENU_ID,
        WINDOW_SUBMENU_ID,
    },
    AppHandle, Runtime,
};

const THIRD_PARTY_LICENSES: &[ThirdPartyLicense] = &[
    ThirdPartyLicense {
        name: "@tailwindcss/vite",
        version: "4.2.4",
        license: "MIT",
    },
    ThirdPartyLicense {
        name: "@tauri-apps/api",
        version: "2.11.0",
        license: "Apache-2.0 OR MIT",
    },
    ThirdPartyLicense {
        name: "@tauri-apps/plugin-dialog",
        version: "2.7.0",
        license: "MIT OR Apache-2.0",
    },
    ThirdPartyLicense {
        name: "@tauri-apps/plugin-opener",
        version: "2.5.3",
        license: "MIT OR Apache-2.0",
    },
    ThirdPartyLicense {
        name: "lucide-react",
        version: "1.14.0",
        license: "ISC",
    },
    ThirdPartyLicense {
        name: "react",
        version: "19.2.5",
        license: "MIT",
    },
    ThirdPartyLicense {
        name: "react-dom",
        version: "19.2.5",
        license: "MIT",
    },
    ThirdPartyLicense {
        name: "react-markdown",
        version: "10.1.0",
        license: "MIT",
    },
    ThirdPartyLicense {
        name: "remark-gfm",
        version: "4.0.1",
        license: "MIT",
    },
    ThirdPartyLicense {
        name: "tailwindcss",
        version: "4.2.4",
        license: "MIT",
    },
];

struct ThirdPartyLicense {
    name: &'static str,
    version: &'static str,
    license: &'static str,
}

/** Builds the native application menu, including the Help > Licenses submenu. */
pub fn build_application_menu<R: Runtime>(app_handle: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let pkg_info = app_handle.package_info();
    let config = app_handle.config();
    let about_metadata = AboutMetadata {
        name: Some(pkg_info.name.clone()),
        version: Some(pkg_info.version.to_string()),
        copyright: config.bundle.copyright.clone(),
        authors: config
            .bundle
            .publisher
            .clone()
            .map(|publisher| vec![publisher]),
        ..Default::default()
    };
    let licenses_menu = build_licenses_menu(app_handle)?;
    let window_menu = Submenu::with_id_and_items(
        app_handle,
        WINDOW_SUBMENU_ID,
        "Window",
        true,
        &[
            &PredefinedMenuItem::minimize(app_handle, None)?,
            &PredefinedMenuItem::maximize(app_handle, None)?,
            #[cfg(target_os = "macos")]
            &PredefinedMenuItem::separator(app_handle)?,
            &PredefinedMenuItem::close_window(app_handle, None)?,
        ],
    )?;
    let help_menu = Submenu::with_id_and_items(
        app_handle,
        HELP_SUBMENU_ID,
        "Help",
        true,
        &[
            &licenses_menu,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::separator(app_handle)?,
            #[cfg(not(target_os = "macos"))]
            &PredefinedMenuItem::about(app_handle, None, Some(about_metadata.clone()))?,
        ],
    )?;

    Menu::with_items(
        app_handle,
        &[
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app_handle,
                pkg_info.name.clone(),
                true,
                &[
                    &PredefinedMenuItem::about(app_handle, None, Some(about_metadata))?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::services(app_handle, None)?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::hide(app_handle, None)?,
                    &PredefinedMenuItem::hide_others(app_handle, None)?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::quit(app_handle, None)?,
                ],
            )?,
            #[cfg(not(any(
                target_os = "linux",
                target_os = "dragonfly",
                target_os = "freebsd",
                target_os = "netbsd",
                target_os = "openbsd"
            )))]
            &Submenu::with_items(
                app_handle,
                "File",
                true,
                &[
                    &PredefinedMenuItem::close_window(app_handle, None)?,
                    #[cfg(not(target_os = "macos"))]
                    &PredefinedMenuItem::quit(app_handle, None)?,
                ],
            )?,
            &Submenu::with_items(
                app_handle,
                "Edit",
                true,
                &[
                    &PredefinedMenuItem::undo(app_handle, None)?,
                    &PredefinedMenuItem::redo(app_handle, None)?,
                    &PredefinedMenuItem::separator(app_handle)?,
                    &PredefinedMenuItem::cut(app_handle, None)?,
                    &PredefinedMenuItem::copy(app_handle, None)?,
                    &PredefinedMenuItem::paste(app_handle, None)?,
                    &PredefinedMenuItem::select_all(app_handle, None)?,
                ],
            )?,
            #[cfg(target_os = "macos")]
            &Submenu::with_items(
                app_handle,
                "View",
                true,
                &[&PredefinedMenuItem::fullscreen(app_handle, None)?],
            )?,
            &window_menu,
            &help_menu,
        ],
    )
}

/** Builds disabled informational license items for the native Help menu. */
fn build_licenses_menu<R: Runtime>(app_handle: &AppHandle<R>) -> tauri::Result<Submenu<R>> {
    let license_items = THIRD_PARTY_LICENSES
        .iter()
        .map(|package_license| {
            MenuItem::new(
                app_handle,
                format!(
                    "{} v{} - {}",
                    package_license.name, package_license.version, package_license.license
                ),
                false,
                None::<&str>,
            )
        })
        .collect::<tauri::Result<Vec<MenuItem<R>>>>()?;
    let license_item_refs = license_items
        .iter()
        .map(|item| item as &dyn IsMenuItem<R>)
        .collect::<Vec<&dyn IsMenuItem<R>>>();

    Submenu::with_items(app_handle, "Licenses", true, &license_item_refs)
}
