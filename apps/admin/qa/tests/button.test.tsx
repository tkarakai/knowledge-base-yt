import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { Button } from "@repo/design-system";

describe("Button (admin)", () => {
  it("renders with text", () => {
    render(<Button>Admin Action</Button>);
    expect(screen.getByRole("button", { name: "Admin Action" })).toBeInTheDocument();
  });
});
