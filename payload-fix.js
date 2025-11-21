// Pass through ONE single lead to the AI node
// This code runs once for each item in the input array

const item = $input.item.json;

// Build the clean lead object the assistant expects
return [
  {
    json: {
      lead: {
        id: item.id || null,
        first_name: item.first_name || null,
        last_name: item.last_name || null,
        email: item.email || null,
        phone: item.phone || null,
        contact_name: item.first_name
          ? `${item.first_name} ${item.last_name || ''}`.trim()
          : null,
        organization_name: item.organization_name || null,
        domain: item.domain || null,
        vertical: item.vertical || "iv_hydration",
        fit: item.fit || null,
        score: item.score ?? null,
        rating: item.rating ?? null,
        review_count: item.review_count ?? null,
        has_reviews: item.has_reviews ?? false,
        research_summary: item.research_summary || "",
        merged_snippet: item.merged_snippet || "",
        search_query: item.search_query || null,
        google_match_confidence: item.google_match_confidence ?? null,
        email_sent_count: item.email_sent_count ?? 0,
        replied: item.replied ?? false,
        status: item.status || "new",
        metadata: item.metadata || {}
      }
    }
  }
];


