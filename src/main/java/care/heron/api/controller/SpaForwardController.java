package care.heron.api.controller;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

// Forwards SPA deep links to index.html so React Router can take over.
// Path regex {[^.]+} matches segments without dots — anything with a dot
// (e.g. /brand/heron.svg, /assets/index-abc.js) hits the static resource
// handler first and never reaches this controller. /api/** routes are
// handled by @RestController beans which Spring matches before this one.
@Controller
public class SpaForwardController {

    @GetMapping(value = {"/{path:[^.]+}", "/{path:[^.]+}/{subPath:[^.]+}", "/{path:[^.]+}/{subPath:[^.]+}/**"})
    public String forward() {
        return "forward:/index.html";
    }
}
