import { json, type LoaderFunction } from "@remix-run/node";
import { Outlet, useLoaderData } from "@remix-run/react";
import {
  AppProvider,
  Frame,
  Navigation,
  TopBar,
  Sidebar,
} from "@shopify/polaris";
import {
  HomeIcon,
  SettingsIcon,
  QuestionMarkIcon,
} from "@shopify/polaris-icons";
import { ShopifyApp } from "@shopify/shopify-app-remix/server";

interface ContextData {
  shop: string;
  apiKey: string;
}

export const loader: LoaderFunction = async ({ context }) => {
  return json({
    shop: context.shop,
    apiKey: process.env.SHOPIFY_API_KEY,
  });
};

export default function App() {
  const { shop } = useLoaderData<ContextData>();

  const navigationItems = [
    {
      url: "/app",
      label: "Dashboard",
      icon: HomeIcon,
    },
    {
      url: "/app/settings",
      label: "Settings",
      icon: SettingsIcon,
    },
    {
      url: "/app/help",
      label: "Help & Documentation",
      icon: QuestionMarkIcon,
    },
  ];

  const topBarMarkup = (
    <TopBar
      showNavigationToggle
      userMenu={<TopBar.UserMenu actions={[{ items: [{ content: "Log out" }] }]} />}
    />
  );

  const navigationMarkup = (
    <Navigation location="/app">
      {navigationItems.map((item) => (
        <Navigation.Item
          key={item.url}
          url={item.url}
          label={item.label}
          icon={item.icon}
        />
      ))}
    </Navigation>
  );

  const sidebarMarkup = <Sidebar>{navigationMarkup}</Sidebar>;

  return (
    <AppProvider i18n={{}}>
      <Frame topBar={topBarMarkup} sidebar={sidebarMarkup}>
        <Outlet context={{ shop }} />
      </Frame>
    </AppProvider>
  );
}
